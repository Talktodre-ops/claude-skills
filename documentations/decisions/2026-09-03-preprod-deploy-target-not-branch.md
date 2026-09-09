---
date: 2026-09-03
status: superseded by 2026-09-09-preprod-branch-for-admin-portal
tags: [process, ci, branching, pre-prod]
---

# Pre-prod is a deploy target, not a long-lived branch

**Context.** The goal is that nothing uncertified reaches `dev`, which is the
branch production deploys from. The obvious move is a long-lived `pre-prod`
branch that features merge into first.

**Decision.** Pre-prod is a deployment target. The Azure deploy workflow takes a
`ref` input, so any branch or PR can be deployed to pre-prod, certified there,
and then merged to `dev`. `dev` gets branch protection requiring green CI and
review. No second long-lived branch.

**Why.** A `pre-prod` branch does not actually enforce the goal, because nothing
stops a PR straight to `dev`; the enforcement is branch protection either way.
And it carries a real cost: if feature A merges to `pre-prod`, B and C merge
behind it, and A then fails certification, A is welded in. Reverting it is messy
and leaving it blocks B and C. That is how staging branches rot, and it bites
hardest exactly when the team is busiest. A deploy target has no divergence to
manage and can certify two competing branches on consecutive days.

The cost accepted: there is no branch to point at to answer "what is on pre-prod
right now". That question is answered from the deploy history instead.

**Rejected.** `pre-prod` as an integration branch that features merge into and
that promotes to `dev` (gives a visible integration point, at the price of the
rot described above). Relying on discipline alone, which is the status quo and
is not enforcement.

**Also settled here.** DNS for heimly.ng is Route 53. Pre-prod hostnames get
their own records pointing at the Azure static IP, and are deliberately
distinct from production hostnames so a stray link cannot confuse the two.
Certificates via Let's Encrypt on the box, which requires those records to
resolve first.

**Revisit when.** More than a couple of people are certifying simultaneously and
"which branch is on pre-prod" becomes a real coordination cost.
