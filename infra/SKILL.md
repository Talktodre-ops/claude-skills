---
name: aws-infra-terraform
description: Blueprint for production AWS infrastructure with Terraform and GitHub Actions, proven on a Django and ECS system. Covers the environment-and-module layout, the reversible feature-toggle pattern (count flags that tear a subsystem to zero cost and back), S3 state with native locking, OIDC for CI auth with no static keys, the plan-before-apply discipline the source workflow lacked, the safe ECS deploy ordering (register, migrate as a one-off, abort on failure, then roll), least-privilege IAM with instance and task roles, the security posture for an app behind a TLS-terminating load balancer, secrets through SSM, private-by-default networking, and the SSM and mesh access model. Includes explicit do's and don'ts and the gotchas that bit in production. Use when building, reviewing, or operating this kind of infrastructure.
---

# AWS infrastructure with Terraform

A production infrastructure pattern: Terraform for the platform, GitHub Actions for
delivery, everything private by default and reversible by a single flag. Proven on a
Django and ECS deployment, including a full cost-saving teardown and rebuild that
exercised the toggles for real. The code patterns are generalized (no account ids,
bucket names, domains, or secrets), so they lift into another project by rename.

This file is the map and the rules. Three reference files hold the detail:

- `references/terraform.md`: the environment and module layout, the reversible
  toggle pattern, state and locking, and the plan-before-apply discipline.
- `references/cicd-deploy.md`: OIDC auth, the plan and apply jobs with an approval
  gate, the infra-to-app handoff, and the safe ECS deploy ordering.
- `references/security-secrets-access.md`: secrets, least-privilege IAM, the
  proxy-aware app posture, private networking, and the access model.

## The principles

Reproducible. The platform is code. A reviewer reads a diff, not a console. No
resource is created by clicking.

Reversible. Any optional subsystem is gated by one boolean. Flip it and the
subsystem tears down to zero cost; flip it back and it returns. This makes cost and
feature decisions a one-line, auditable change instead of a code deletion.

Least privilege. CI authenticates with OIDC, not stored keys. Runtime code
authenticates with instance and task roles, not stored keys. Every policy is scoped
to the project's resource namespace, with conditions layered on top.

Private by default. Compute, data, and cache live in private subnets with no public
ingress. The only public thing is the load balancer. Humans reach the inside through
SSM or a mesh VPN, never an open SSH port.

Plan before apply. Read the rendered diff before it touches production. The source
system's apply step ran with `-auto-approve` and no plan-review between the reviewer
approval and the apply, which is a real footgun. The skill treats a reviewed plan as
mandatory (see the do's and the terraform reference).

## The layered model

1. State: one S3 backend per environment, native locking, a bootstrap module that
   creates the state bucket itself.
2. Composition: thin environment roots wire modules together by passing one module's
   outputs into the next module's inputs. Modules hold all resource logic.
3. Toggles: optional subsystems behind `count = var.enable_X ? 1 : 0`, with every
   reference indexed `[0]` and every output and dependent input guarded.
4. Delivery: GitHub Actions with OIDC. Infra CI applies Terraform and publishes
   "where things live" to SSM; app CI reads those and deploys.
5. Runtime security: instance and task roles, the proxy-aware Django posture,
   security groups that reference other groups instead of CIDRs.
6. Access: SSM port-forward, a mesh subnet router, and a break-glass bastion, all
   outbound-only with no public ports.

## Build order

1. Bootstrap the state bucket (a tiny separate module with local state).
2. Write the base modules (network, data stores) and a thin environment root that
   wires them.
3. Add the OIDC role with a trust policy scoped to your org, repos, branches, and
   environments. Wire the infra workflow to assume it.
4. Add a plan job on pull requests and an apply job gated by an environment
   reviewer. Make the apply read a reviewed plan.
5. Put optional subsystems behind toggles from the start, even if they default on.
6. Deliver secrets through SSM and runtime cloud access through roles. No static
   keys anywhere.
7. Add the app deploy workflow with the safe migration ordering.
8. Keep everything in private subnets and add the access paths last.

## Do

- Run `terraform plan` and read the diff before any production apply. Treat an
  unreviewed apply as unshippable.
- Run production Terraform through CI, not from a laptop. A local provider older
  than the one that wrote state can downgrade state, and a stale local secrets file
  can overwrite the live one.
- Put every optional subsystem behind a `count` toggle, and guard every reference,
  output, and dependent input with the same `var.enable_X ?` ternary.
- Authenticate CI with OIDC and runtime with instance and task roles. Scope every
  policy to the project namespace.
- Run migrations as a one-off task against the new image before rolling the
  services, and abort the deploy if they fail.
- Reference security groups by id, not by CIDR, for service-to-service rules.
- Deliver secrets as SSM parameters injected into the task at boot. Keep them out of
  the image, the task definition, git, and CI logs.
- Decide per ECS service whether CI or Terraform owns the rollout, and make exactly
  one of them authoritative.

## Don't

- Do not apply to production without seeing the plan. The reviewer approves a job,
  not a diff, so the diff has to be read separately.
- Do not run production Terraform locally for anything that writes.
- Do not use `count` without indexing `[0]` and guarding the outputs; an
  unguarded reference to a disabled module fails to plan.
- Do not put static AWS keys in CI, in code, or in state.
- Do not roll the services before migrations succeed. Expand-only migrations plus
  migrate-before-roll means schema is always ahead of code and a bad migration fails
  closed.
- Do not destroy a security group that another group still references; remove the
  cross-reference first or you get a dependency violation.
- Do not expect `force_destroy` to apply retroactively; it must be live in state
  before the apply that destroys the bucket.
- Do not let both CI and Terraform own an ECS service's task-definition revision;
  they will revert each other.

## Non-negotiables

- A reviewed plan precedes every production apply.
- Production writes go through CI.
- No static keys: OIDC for CI, roles for runtime.
- Optional subsystems are reversible by one flag, fully guarded.
- Migrations run and pass before the new code serves traffic.
- Nothing public except the load balancer.
