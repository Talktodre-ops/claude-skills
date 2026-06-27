# Terraform: structure, toggles, state, plan discipline

Generalized. Placeholders: `<region>`, `tf-state-bucket`, `<env>` for `dev` or
`prod`.

## Structure

Environments compose, modules implement.

```
infra/
  bootstrap/                 # one-time: creates the state bucket itself (local state)
  environments/
    dev/   {main,variables,outputs,versions}.tf  *.tfvars   (gitignored)
    prod/  {main,variables,outputs,versions}.tf  *.tfvars   (gitignored)
  modules/
    vpc/ rds/ elasticache/ s3-bucket/ secrets/ ecs-cluster/
    ecs-services/ dns/ iam-oidc-app/ monitoring/ bastion/ tailscale-router/
  scripts/                   # local plan helpers, SSM tunnels
```

The environment root is thin. It declares the one provider, reads pre-existing
secrets through data sources, and wires modules by passing one module's outputs into
the next module's inputs:

```hcl
# environments/prod/main.tf
module "rds" {
  source             = "../../modules/rds"
  vpc_id             = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnet_ids
}

module "ecs_services" {
  source        = "../../modules/ecs-services"
  cluster_id    = module.ecs_cluster.cluster_id
  db_endpoint   = module.rds.endpoint
  app_env_param = module.secrets.app_env_parameter_arn
}
```

Compute subnet CIDRs instead of hardcoding them, so the layout follows the VPC CIDR:

```hcl
locals {
  public_subnet_cidrs  = [for i in range(local.az_count) : cidrsubnet(var.vpc_cidr, 8, i)]
  private_subnet_cidrs = [for i in range(local.az_count) : cidrsubnet(var.vpc_cidr, 8, i + 10)]
}
```

## The reversible toggle pattern

This is the pattern that made a full cost-saving teardown a one-line change. Gate an
optional subsystem with `count`, then index and guard everything that touches it.

```hcl
# the module: count makes it a list of zero or one
module "monitoring" {
  count  = var.enable_monitoring ? 1 : 0
  source = "../../modules/monitoring"
  vpc_id = module.vpc.vpc_id
}
```

Because a counted module is a list, every reference is `[0]`, and every output and
every dependent input is guarded with the same ternary so the configuration still
plans cleanly when the module is absent:

```hcl
# a dependent input, guarded (pass null when monitoring is off)
monitoring_security_group_id = var.enable_monitoring ? module.monitoring[0].security_group_id : null

# a guarded output
output "monitoring_private_ip" {
  value = var.enable_monitoring ? module.monitoring[0].private_ip : null
}

# a dependent allow-list, guarded (empty when the bastion is off)
allowed_security_group_ids = var.enable_bastion ? [module.bastion[0].security_group_id] : []
```

The discipline that keeps it safe: `count` always paired with `[0]`, every
cross-module reference and output wrapped in the same `var.enable_X ?`, and inputs
that feed other modules guarded too, so a disabled subsystem never breaks the plan of
the things that referenced it.

There is also a softer toggle for behavior that should change without destroying
anything: a plain bool threaded into a module that flips a value with a ternary. For
example, switching a container's log output between two sinks by emptying a map:

```hcl
options = var.enable_loki_logging ? tomap(local.loki_options.api) : tomap({})
```

The two kinds compose, and their order can matter. If a soft toggle points the app at
a host that a hard toggle is about to destroy, apply the soft toggle first (point the
app away), then the hard toggle (destroy the host). Reverse the order on restore.

## State and locking

One state file per environment in an S3 backend, with native S3 locking (Terraform
1.10 and later), so there is no separate lock table to manage.

```hcl
# environments/prod/versions.tf
terraform {
  required_version = ">= 1.10.0"
  backend "s3" {
    bucket       = "tf-state-bucket"
    key          = "prod/terraform.tfstate"   # dev uses dev/terraform.tfstate: isolated states, one bucket
    region       = "<region>"
    encrypt      = true
    use_lockfile = true                        # native S3 conditional-write locking
  }
}
```

Committing the literals lets `init`, `validate`, and `plan` run locally, but CI
re-supplies them at init from repository variables so the pipeline is not bound to one
bucket:

```bash
terraform init \
  -backend-config="bucket=${TF_STATE_BUCKET}" \
  -backend-config="key=prod/terraform.tfstate" \
  -backend-config="region=${AWS_REGION}"
```

The bootstrap module solves the chicken-and-egg: a tiny separate root with local state
that creates the state bucket with versioning, encryption, and full public-access
block. Run it once before any environment can init.

## Plan before apply

The source workflow approved a job, then applied with `-auto-approve` and no rendered
diff in between. That means a drift or an unintended destroy applies without a human
seeing it. Do not copy that. The correct shape:

- On pull requests, run `terraform plan` and post the diff for review. Read it.
- For the production apply, save the plan and apply that exact saved plan, so what
  runs is what was reviewed:

```bash
terraform plan  -var-file=prod.tfvars -out=tfplan      # render and save
# review tfplan (in the PR, or `terraform show tfplan`)
terraform apply tfplan                                  # apply the reviewed plan, no re-plan
```

Applying a saved plan file is the mechanism that closes the gap: `apply tfplan` does
not re-plan, so it cannot quietly include a change that appeared after review. If your
pipeline cannot pass a plan artifact between jobs, then at minimum run `plan` and read
the diff before dispatching the apply, and never treat the reviewer's job approval as
a substitute for reading the plan.

## Targeted applies, and their sharp edges

A scoped apply (`-target=...`) is useful for a bounded change without reconciling
unrelated drift, but it skips Terraform's normal dependency reconciliation, which
causes two specific failures:

- Destroying a security group that another group still references fails with a
  dependency violation, because the targeted run did not first remove the referencing
  rule. Remove the cross-reference first (or do a full apply for teardowns).
- `force_destroy` on a bucket is not retroactive. Adding it in the same change that
  sets the module `count` to zero does not help, because the bucket is destroyed from
  its prior state where the flag was still false, so a non-empty bucket errors. Land
  `force_destroy` in one apply, then destroy in a later one. Or empty the bucket
  manually first.

If you accept user-supplied targets in a workflow, keep them in an environment
variable and expand them in the script rather than interpolating into the command
line, to avoid shell injection:

```bash
TARGET_ARGS=""
for t in $TARGETS; do TARGET_ARGS="$TARGET_ARGS -target=$t"; done   # blank input means a full apply
```

## Who owns the rollout

Put `lifecycle { ignore_changes = [task_definition] }` on every ECS service whose
task-definition revision is owned by the app deploy pipeline. Terraform creates the
service once; CI owns the revisions after that. Without this, every `terraform apply`
reverts the service to the last Terraform-created revision and undoes live deploys.

The mirror-image bug: a service that Terraform manages but CI never rolls will sit on
a stale revision forever, so a corrected Terraform revision never reaches running
tasks. Decide per service who is authoritative, CI or Terraform, and make exactly one
of them so. If Terraform owns it, trigger a rollout when the task-definition ARN
changes; if CI owns it, ignore the task definition in Terraform.

## A note on running locally

`plan`, `validate`, and `fmt` are fine locally and encouraged. Writes
(`apply`, `destroy`) for production should go through CI, for two concrete reasons.
A local AWS provider older than the one that wrote remote state can fail to decode
state and can downgrade it. And a gitignored secrets or env file on a laptop can be
stale, so a local apply silently pushes old config over the live parameter. CI uses
pinned provider versions and writes those files fresh from secrets.
