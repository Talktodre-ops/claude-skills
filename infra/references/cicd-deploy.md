# CI/CD and deploys

GitHub Actions, OIDC for AWS auth, two pipelines: infra (Terraform) and app (build
and deploy to ECS). Generalized placeholders: `<github-org>`, `<account-id>`,
`<env>`.

## OIDC, no static keys

The runner mints a short-lived OIDC token and exchanges it for temporary STS
credentials scoped to a role. There is no access key stored anywhere.

```yaml
permissions:
  id-token: write     # lets the runner request the OIDC token
  contents: read

jobs:
  apply:
    steps:
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_ROLE_ARN }}    # assumed via web identity
          aws-region: ${{ vars.AWS_REGION }}
```

The role's trust policy pins the audience and a `StringLike` on the subject, built
from explicit allow-lists of repos, branches, and environments. Include both the
`ref:refs/heads/<branch>` and the `environment:<name>` subject forms, because a job
that declares `environment:` changes the OIDC subject claim:

```hcl
# modules/iam-oidc-app, trust condition (generalized)
allowed_subjects = flatten([
  for repo in var.app_repos : concat(
    [for b in var.deploy_branches      : "repo:<github-org>/${repo}:ref:refs/heads/${b}"],
    [for e in var.deploy_environments  : "repo:<github-org>/${repo}:environment:${e}"],
  )
])
```

Only the named repos on the named branches and environments can assume the role. The
role's own policies are scoped to the project namespace (see the IAM section of
`security-secrets-access.md`).

## Plan, apply, and the approval gate

Separate the jobs and gate them by event and branch:

- A plan job on pull requests runs `terraform plan` only, read-only, and posts the
  diff for review.
- An apply job for production runs only on a manual dispatch and declares
  `environment: production`. That line is the required-reviewer gate: GitHub blocks
  the job until a configured reviewer approves.

The footgun to avoid: the source workflow ran `terraform apply -auto-approve`
immediately after the reviewer gate, with no rendered plan between approval and
apply. The reviewer approved the job, not the diff. The correct implementation
applies a saved, reviewed plan (covered in `terraform.md`): `plan -out=tfplan`, review
`tfplan`, `apply tfplan`. The job gate controls who can trigger; the saved plan
controls what runs.

If you accept scoped targets as a dispatch input, keep them in an env var and expand
them in the script, never interpolate input straight into the command line:

```yaml
on:
  workflow_dispatch:
    inputs:
      targets: { description: "space-separated -target list (blank = full apply)", required: false }
env:
  TARGETS: ${{ inputs.targets }}
```

## The infra-to-app handoff

The infra pipeline publishes "where things live" to SSM as its last apply step. The
app pipelines read those parameters at deploy time instead of hardcoding ARNs and
names, so infra and app stay decoupled.

```bash
# write-deploy-params, run after apply
ECR_BACKEND=$(terraform output -raw ecr_backend_repository_url)
CLUSTER=$(terraform output -raw cluster_name)
aws ssm put-parameter --name "/myapp-<env>/deploy/ecr-backend-url" --type String --value "$ECR_BACKEND" --overwrite
aws ssm put-parameter --name "/myapp-<env>/deploy/cluster"         --type String --value "$CLUSTER"     --overwrite
# ... service names, load balancer DNS, the app base URL, the app bucket
```

This is the seam between the two pipelines. Infra owns "what exists and where"; the
app CI reads it. Neither hardcodes the other's identifiers.

## The safe ECS deploy ordering

This is the load-bearing pattern for deploying code that includes a schema migration.
Four steps, in order, so a bad migration fails closed instead of half-deploying.

1. Register the new task-definition revisions first, before touching any service, so
   the migration runs against the new image and not old code. Build and push the
   image with two tags: an immutable `sha-<git-sha>` for precise rollback, and the
   mutable tag your Terraform task definitions reference.

```bash
aws ecs describe-task-definition --task-definition "$FAMILY" \
  | jq '.taskDefinition | {family,containerDefinitions,...}' \
  | jq '.containerDefinitions[0].image = "'"$IMAGE_SHA"'"' > taskdef.json
aws ecs register-task-definition --cli-input-json file://taskdef.json
```

2. Run migrations as a one-off task against the new revision. Pull the network config
   from the live service so subnets and security groups are not hardcoded, override the
   command to run the migration, wait for the task to stop, and read its exit code.

```bash
NET=$(aws ecs describe-services --cluster "$CLUSTER" --services "$API_SVC" \
  --query 'services[0].networkConfiguration' --output json)
TASK_ARN=$(aws ecs run-task --cluster "$CLUSTER" --task-definition "$NEW_REVISION" \
  --launch-type FARGATE --network-configuration "$NET" \
  --overrides '{"containerOverrides":[{"name":"api","command":["python","manage.py","migrate","--noinput"]}]}' \
  --query 'tasks[0].taskArn' --output text)
aws ecs wait tasks-stopped --cluster "$CLUSTER" --tasks "$TASK_ARN"
EXIT=$(aws ecs describe-tasks --cluster "$CLUSTER" --tasks "$TASK_ARN" \
  --query 'tasks[0].containers[0].exitCode' --output text)
```

3. Abort the deploy if the migration failed. The services are still on the old
   revision, so a failure leaves old code on the old schema, no torn state.

```bash
if [ "$EXIT" != "0" ]; then
  echo "migrations failed (exit=$EXIT). Aborting: old version keeps serving the old schema." >&2
  exit 1
fi
```

4. Only then roll the services to the new revisions, and poll to stable. The built-in
   `aws ecs wait services-stable` caps around ten minutes, so for slow rollouts write a
   longer poll loop rather than letting the wait time out and report a false failure.

Why this works: with expand-only migrations and migrate-before-roll, the schema is
always a superset of what the running code needs, so the old code keeps working during
the migration and the new code finds its schema ready. The immutable SHA tag is the
rollback target if the new revision misbehaves after it goes live.

## First-run import shim

If a resource was seeded manually before Terraform managed it (a pre-created SSM
parameter, for example), an idempotent import step lets Terraform adopt it without
failing on reruns:

```bash
terraform import 'module.secrets.aws_ssm_parameter.app_env' "/myapp-<env>/deploy/app-env" \
  2>&1 | grep -v "already managed\|Resource already" || true
```
