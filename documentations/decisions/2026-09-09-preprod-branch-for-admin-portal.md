---
date: 2026-09-09
status: accepted
supersedes: 2026-09-03-preprod-deploy-target-not-branch
tags: [process, branching, pre-prod, admin-portal]
---

# A pre-prod branch carries the admin portal until testers sign it off

**Context.** [[2026-09-03-preprod-deploy-target-not-branch]] settled that
pre-prod would be a deploy target rather than a long-lived branch, on the
grounds that a staging branch rots when one feature fails certification behind
others. The admin portal changed the shape of the question: it is eight
stacked pull requests across two repos (Phases 0 to 6), certified together as
one product by testers on the Azure box, and nothing else was waiting to be
certified alongside it. Merging it into `dev` before that sign-off would let a
production hotfix, pressed from `dev`, carry untested admin work with it.

**Decision.** Both repos carry a `pre-prod` branch cut from the tip of `dev` on
2026-09-09. The admin portal PRs were retargeted and merged into it in order.
Phases 7 and 8 branch off `pre-prod` and open PRs against it. The Azure deploy
is pressed from `pre-prod`. When testers sign off, one PR from `pre-prod` into
`dev`, reviewed as a whole, then the production deploy from `dev` as today.
Any hotfix that lands on `dev` meanwhile is merged into `pre-prod` at once,
`dev` into `pre-prod`, never a rebase.

**Why.** The rot the earlier record warned about comes from unrelated features
queuing behind each other. Here the branch holds one product with one
certification, so there is nothing to weld in behind it. The branch also
answers "what is on pre-prod right now" directly, which the deploy-target
model gave up.

**What is kept from the earlier record.** The deploy workflow still takes any
ref, `dev` still needs branch protection with green CI and review, and pre-prod
hostnames stay distinct from production. The earlier record's caution stands
for the general case: when the admin portal has merged to `dev`, the branch
should be deleted rather than kept as a permanent staging line, unless a
second product-sized certification is under way.

**Open on Dre's side.** `ci.yml` runs on PRs into `dev` only; `pre-prod` has
to be added to its branch lists on both repos so PRs into it get checks.

**Rejected.** Merging to `dev` now (ships nothing by itself, but exposes the
next hotfix). Reviving `main` on the frontend (stale, and absent on the
backend).

**Revisit when.** The admin portal has merged to `dev` and the branch has no
product left to carry.
