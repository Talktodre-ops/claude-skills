---
date: 2026-08-28
status: accepted
tags: [infra, aws, terraform, security]
---

# Infra remediation pass: fix live drift, align Terraform, add alerting

**Context.** The Well-Architected checklist (`.agent/heimly-implementation-plan
1.md`, items A1-A11) claimed actions were taken during a break. Live verification
showed only three were: RDS deletion protection + 30d retention, ASG scaled 4→3
hosts (but with max=3, killing deploy headroom), orphan EC2s terminated.
Everything else was untouched, and `prod.tfvars` still had
`enable_tailscale_router = true` for a terminated router.

**Decision.** Same-day pass (Infra-Heimly PR #3, branch tf-updates): ASG max
back to 4; api/frontend deploy percents 0/200 → 100/200 (start-before-stop);
`app-env` SSM param String → SecureString; EMQX log retention 30d; ALB deletion
protection on; SNS topic + 5 CloudWatch alarms (ALB 5xx, per-TG unhealthy hosts,
RDS storage/CPU) authored in Terraform; tailscale flag set false. EMQX kept
0/100 deliberately (unclustered; two brokers = the June split-brain). Parked for
explicit go: RDS Multi-AZ off (~$25/mo), Valkey transit+AUTH (needs rediss://
window), Container Insights (real metric cost), hemily-test bucket deletion.

**Why.** The lesson underneath: console changes that never reach tfvars are
DRIFT LANDMINES, the next apply resurrects the terminated router and reverts the
scale-in. Every live change must land in Terraform in the same pass. The
percent fix matters because with desired_count=1 and min-healthy 0%, a deploy
where the second task can't place takes the service to zero.

**Rejected.** Trusting the checklist's claims (verify live, always); killing the
port-squatting node blindly (identified it as login debris first).

**Revisit when.** The parked items get a go; alarms fire and thresholds need
tuning; CI apply (A9 plan-then-apply) still unverified.

Related: [[2026-08-28-rust-deferred]]
