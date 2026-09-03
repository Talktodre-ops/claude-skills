---
date: 2026-08-28
status: accepted
tags: [architecture, delivery, flags, d7]
---

# D7: thin homegrown feature flags

**Context.** Multi-week Phase 2 features (escrow, referrals, redesigns) must
coexist with quick prod fixes. Long-lived branches were the only isolation tool,
and they rot. Question: how do teams ship half-done work safely and revoke fast?

**Decision.** Trunk-based development plus a thin homegrown flag system:
`FeatureFlag` model (name, enabled, allowlist users/orgs), one
`flags.enabled(name, user, org)` service (PlanLimitService pattern), flags
evaluated server-side only and delivered in the auth bootstrap payload, FE
consumes via `useFlag()`. `rollout_pct` + deterministic hash bucketing added
later when percentage ramps matter. Lifecycle: flag born in the feature's first
PR, deleted in its last (after 100% + 1-2wk soak). Permanent flags are kill
switches only: paystack, qoreid, email. Old code path stays untouched while the
flagged path lives (revoke = flip off); expand/contract migrations mandatory
while both paths coexist. Sprint 0 item E0.9 builds it.

**Why.** The pain at our size is a blocked main branch, not gradual rollout; a
boolean with an allowlist solves that for half a day of work. Flip-a-row revoke
beats emergency deploys. Deleting flags on completion prevents the 40-stale-flags
failure mode. Kill switches are the one permanent class because "turn off a
misbehaving provider without deploying" is valuable forever.

**Rejected.** LaunchDarkly/Unleash/Flagsmith (external dependency, overkill);
django-waffle (fine, but homegrown matches our admin + service patterns for the
same effort); percentage machinery now (nothing meaningful to bucket yet); flags
for plan/role gating (stays in PlanLimitService/RoleGuard).

**Revisit when.** Real traffic makes ramps meaningful (add rollout_pct then), or
flag count regularly exceeds ~6 live (discipline is failing).

Related: [[2026-08-28-staging-demoted]], [[2026-08-27-phase2-build-sequence]]
