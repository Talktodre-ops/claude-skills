---
name: terraform
description: Keeping Terraform, its state and the live AWS account consistent, so a plan means what it says and an apply does only what was reviewed. Covers ownership of every field (Terraform versus CI versus autoscaling), clean plans as the standard (no churn, no noise), scoped and targeted applies and what they drag in, plans run locally versus in CI, version and lock-file pinning, cross-variable checks that break init on Terraform 1.15, empty blocks and AWS-filled defaults that force replacement, force_new_deployment, AMI lookups, partial applies, and API rules a plan cannot see. Use when writing, reviewing, planning or applying Terraform for AWS, or when a plan shows changes nobody made.
---

# Consistent Terraform

The goal is one thing: **the code, the state and the account agree.** When they do, a plan is a precise list of what will change and nothing else, and an apply is boring. Every rule here protects that.

The layout this assumes (environment roots, modules, `count` toggles, S3 state, OIDC, a gated apply job) is in [`../../infra/SKILL.md`](../../infra/SKILL.md). The production it was learned on is described in [`../README.md`](../README.md).

## The standard: a clean plan

After any apply, a fresh plan must say **No changes**. Anything else is one of three things, and each has a fix:

| A plan shows... | It is | Fix |
|---|---|---|
| A change nobody made in code | Drift (someone used the console, or another system owns the field) | Write the live value back to code, or hand ownership to that system with `ignore_changes` |
| The same change on every plan | Churn: the config differs from what AWS stores | State the defaults AWS fills in; remove empty blocks AWS does not store |
| A change from a data source | A lookup moved (newest AMI, a parameter) | Pin it, or accept it and say so in the PR |

Never call recurring changes "noise". In the source system, task-definition churn fired a provisioner on every apply that moved Celery onto an old image tag.

## Ownership: exactly one owner per field

For every resource, decide who owns each changing field and encode it:

- **CI owns the running image.** The app deploy registers task definitions and updates services. Terraform creates the service once and carries `ignore_changes = [task_definition]`. Otherwise every apply reverts the app to Terraform's revision.
- **Autoscaling owns the count.** With target tracking on, `ignore_changes = [desired_count]`; the variable still seeds the floor.
- **Terraform owns everything else,** and nobody changes it from the console. A console fix is written back to code the same day or the next apply undoes it.

## Conventions

- One environment root per account or stage, thin, wiring modules together. Resource logic only in modules.
- Optional subsystems behind `count = var.enable_x ? 1 : 0`, every reference indexed `[0]`, every output and dependent input guarded by the same condition.
- Comments say why a setting is what it is (the incident or the number behind it), not what the HCL says.
- Defaults that AWS fills in are written out: `essential`, empty `mountPoints`, `portMappings`, `volumesFrom`, `systemControls`, `hostPort`, the FireLens router's `user`.
- Never write an empty block to satisfy a schema. If AWS does not store it, it reads as drift forever.
- `terraform fmt` clean, enforced in CI.
- Pin the Terraform version in CI and locally to the same release. Commit `.terraform.lock.hcl` for each root, so CI uses the provider versions the plan was reviewed with.
- Secrets never in tfvars or code. Values Terraform generates (`random_password`) are in state, so the state bucket is treated as secret: encrypted, private, access-logged.

## Plan, then apply exactly that

- Read the plan before every production apply. A reviewer approving a workflow run approves a job, not a diff.
- A plan run in CI and a plan run locally can differ. CI injects variables (a GA id, verification tokens) that a laptop does not; local secrets files can be stale. A local plan is a read-only check (`-lock=false`, nothing written), never the source of truth for those values.
- Plan with the same variables the apply will use. The best form is `plan -out` in CI, reviewed, then `apply` of that file.
- Plan every environment root in CI on every PR. A root nobody plans rots: the dev root in the source system failed to plan for weeks because it passed arguments a module no longer took, and every PR showed a red check people learned to ignore.

## Scoped and targeted applies

`-target` is for bounded changes to production (a few resources, while unrelated drift is reconciled separately). Know what it does:

- **It drags in dependencies.** Targeting an ECS service also applies its task definition, the cluster's launch template and anything else upstream that differs. In the source system a four-service apply also moved the launch template to a newer AMI. Read the targeted plan; it lists them.
- **It skips everything else,** including checks that live on other resources. A precondition on a resource outside the target does not run.
- After a targeted apply, run a full plan to see what is still pending.

## Things that bite

**Init and validation**

- **Cross-variable validation can break `init`.** On Terraform 1.15, a `validation` block that reads another variable (`!var.a || var.b`) failed `terraform init` with "Reference to uninitialized variable", which stopped every apply. Put rules that relate two variables in `lifecycle { precondition {} }` on a small `terraform_data` resource instead; they fail the plan with the same message.
- **Test the init path the CI runs,** with the real backend config, in a scratch `TF_DATA_DIR`. A local `.terraform` that was initialised long ago hides init failures.

**Plans that lie by omission**

- **The plan cannot see AWS API rules.** A clean plan can fail at apply: ECS refused binpack placement and a 100% deploy ceiling because AZ rebalancing was on, a default the code never mentioned. When changing placement, deployment settings or networking, read the AWS constraints for that API, and set the related defaults explicitly (`availability_zone_rebalancing`).
- **Applies are not atomic.** When one resource fails, the others in the same apply may already have changed. Read the apply log for every "Modifications complete" before assuming nothing happened.
- **Some argument changes force replacement.** Look for `forces replacement` in the plan. Replacing a discovery service, a database or a cache node is not an in-place tweak; AWS may refuse to delete it while it has registered instances.

**Side effects of an apply**

- **`force_new_deployment = true` redeploys the service on any update to it.** A placement change rolls every task. On packed hosts, rolling four services at once can add a host. Apply such changes one service at a time, or at a quiet hour, and check the host count after.
- **Provisioners triggered by resource ids fire whenever the id changes,** including churned task definitions. Make them idempotent and make them keep the image the service runs.
- **Data-source lookups move.** "Most recent ECS AMI" changes whenever AWS publishes one, so the launch template shows a change on later plans. It only affects hosts started later, but say so in the PR, or pin the AMI and bump it deliberately.

**State**

- **Never run production applies from a laptop.** An older local provider can rewrite state; a stale local secrets file can overwrite the live one. Production writes go through CI.
- **Use `-lock=false` only for read-only plans.** Anything that writes takes the lock.
- **Import before you manage.** A resource created by hand and then declared is a "create" in the plan that fails on a name clash. Import it, then plan to No changes.

## Checklist for a production change

1. Branch from the integration branch; change only what the task needs.
2. `terraform fmt`; plan every root that uses the changed module.
3. Read the plan line by line. Every change is either in the PR description or a reason not to apply.
4. Note dependencies a targeted apply will drag in, and AWS API rules the plan cannot check.
5. Merge, then apply through CI, scoped when bounded.
6. Read the apply log, then the live state (`describe-*`), then a fresh plan: No changes.
7. Watch the side effects: rollouts finished, host count back to normal, health checks green.

## Non-negotiables

- Code, state and account agree; a recurring diff is a bug.
- One owner per field, encoded with `ignore_changes` where it is not Terraform.
- Reviewed plan before every production apply; production writes only through CI.
- Versions and provider locks pinned and committed.
- After every apply, a clean plan and a live read-back.
