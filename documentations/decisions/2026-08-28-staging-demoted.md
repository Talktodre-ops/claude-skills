---
date: 2026-08-28
status: accepted
tags: [delivery, testing, infra]
---

# Staging demoted: testers on prod allowlist, staging on-demand

**Context.** With flags + allowlists, is a standing staging environment still
needed? Key insight: flags gate whether users can REACH code, not whether code
RUNS. Migrations, boot errors, and shared-surface changes hit everyone on deploy
regardless of flags.

**Decision.** Default feature testing happens in prod behind the flag allowlist
(real environment, real data shapes). The deploy-risk gate moves to CI: boot the
compose stack, run migrations on a scratch DB, tests, smoke endpoints, on every
PR. Prod's own health-checked rolling deploy is the boot-failure net. Staging
becomes an on-demand tool reserved for three categories: schema migrations
against a prod-shaped DB, third-party/money integrations (Paystack webhooks with
test keys), and infra changes. Escrow gets the full ladder: staging test keys →
prod dark → allowlist ₦100 dress run → widen.

**Why.** A standing staging is cost and drift for little value at our size, while
prod-behind-allowlist is a MORE honest test than staging ever was. But money and
migrations deserve a dress rehearsal, so staging survives as a scalpel, not a
stage every feature crosses.

**Rejected.** Always-on staging for everything (cost, drift, false confidence);
no staging at all (first live Paystack webhook hitting untested code).

**Revisit when.** Team grows past a couple of devs, or a prod incident traces to
something staging would have caught.

Related: [[2026-08-28-feature-flags-d7]], [[2026-08-27-preprod-hosting]]
