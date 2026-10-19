---
date: 2026-10-19
status: accepted
tags: [process, payments, branches]
---

# Payments lives on one branch per repo and is merged only when Dre says

Date: 2026-10-19. Status: accepted. Source: Dre: "now it must be on one branch... everything about this payment and escrow will be in the payments-be or fe branch"; later: "we are not going to merge the payment branch for now, i just want it worked on and when we are ready, we will merge it."

## Context

Earlier rounds landed as stacked PRs per wave. Payments touches money tables, a new worker, nine migrations and three apps, and its provider is not live yet.

## Decision

- All payments, escrow and auto-renew work lives on `payments-be` (BE-heimly) and `payments-fe` (FE-heimly), cut from `origin/pre-prod`, with one PR each into pre-prod (BE #240, FE #211). Every later payments change goes on those branches and PRs, not on new ones.
- The PRs stay open and unmerged until Dre says in a message that the time has come. Nothing payments-related is deployed before that.
- Other rounds keep cutting from `origin/pre-prod`; both local checkouts go back to `pre-prod` before any other work. The shared Neon database already carries the branch's migrations, all additive, and its beat rows.
- When merging: backend first (migrations, the `celery_payments` worker and the env keys), then the web PR.

## Why

Money code is reviewed and tested as a whole, not wave by wave; one branch keeps the history in one place and lets the provider spike land on the same PR before merge. Keeping the branch open rather than merged dark keeps pre-prod's deploys and Neon's schema from carrying code that is still changing, except for the additive migrations already applied for the local stack.

## Rejected

- Merging dark behind the flags now: the Payscrow adapter is still assumptions, and the direct split shape is unconfirmed.
- A PR per wave: the review has to see the whole money path at once.

## Revisit when

Payscrow keys arrive and the spike is done, or pre-prod needs a part of the branch (the auto-renew) earlier than the rest. Related: [[2026-10-19-escrow-built-on-a-fake-provider-until-keys-arrive]], [[2026-08-28-branch-naming-multi-repo]].
