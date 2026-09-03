---
date: 2026-08-28
status: accepted
tags: [digest, architecture, back-catalog]
---

# Back-catalog digest: decisions made before this journal existed

Condensed records of earlier calls; each can be promoted to its own file when it
next changes.

- **Org scoping fail-safe.** Active org comes ONLY from `X-Organization-ID`;
  never inferred. Why: a null active-org once bled a tenant's lease into
  landlord/agent lists. Guard: RoleGuard + org-isolation smoke suite.
- **Chat org isolation.** Chats strictly per-org (member's org must match active
  org, admin-support groups exempt). Why: cross-org leakage is a trust-killer in
  a multi-persona product (migration chat.0016).
- **Cookie auth.** HTTPOnly cookie transport with refresh interceptors and idle
  logout; forms must be `method="post"`. Why: XSS-resistant tokens; the form rule
  guards a hydration race that leaked credentials into URLs.
- **ES indexing on_commit.** Index only via `transaction.on_commit`. Why: saves
  inside atomic blocks raced the indexer into indexing uncommitted state.
- **EMQX single broker.** One broker task, stop-then-start deploys. Why: an
  unclustered NLB-vs-ALB broker split silently severed BE↔FE real-time in prod;
  the ECS EMQX config is terraform-owned to prevent drift reverts.
- **Plan limits centralized.** One PlanLimitService, `UNLIMITED = 999`, mirrored
  FE-side. Why: scattered limit checks drift; one service, one shape
  (PLAN_LIMIT_REACHED) for every gate.
- **Free trial: no-card, PREMIUM, opt-in, 90 days.** Why: card-first trials kill
  Nigerian signup conversion; opt-in keeps the trial a deliberate act
  (HEIMLY_TRIAL_DAYS, expiry needs a DB PeriodicTask).
- **Two-phase property creation.** Metadata sync (15s), images background. Why:
  Nigerian mobile uploads are slow/flaky; publishing must not hostage on media.
- **DatabaseScheduler for periodic tasks.** Beat rows live in the DB, created by
  migrations; code schedule is only a seed. Why: deploys must not silently drop
  or duplicate schedules.
- **Monitoring decommissioned (2026-06-26).** Grafana/Loki/Prometheus/GlitchTip
  torn down to $0, reversible via TF flags; CloudWatch + structured JSON logs
  remain. Why: cost during pre-revenue; alarms now come from
  [[2026-08-28-infra-remediation-pass]].
- **Prod DB access via bastion SSM.** Read-only psql through SSM send-command,
  secrets fetched on-box. Why: the Tailscale route died with its router; nothing
  sensitive ever appears in command text.
- **August 2026 cleanup.** ~27k lines of dead code/docs removed across both
  repos, deletions DB-verified against prod and pre-prod before removal. Why:
  Phase 2 starts on a codebase where everything present is real.
