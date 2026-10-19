---
date: 2026-10-19
status: accepted
tags: [payments, escrow, security, agents]
---

# Agent commission comes only from the assignment terms

Date: 2026-10-19. Status: accepted. Source: a read-only security review of the payments branch found the payer could set the commission; fixed the same day.

## Context

The first quote endpoint accepted an `agent_commission` amount from whoever asked for the quote, up to the agreed amount. The owner's share was the agreed amount minus that commission, and direct payments were auto-accepted, so the owner never saw the split. A tenant colluding with an assigned agent could quote direct rent of ₦1,000,000 with a ₦1,000,000 commission: the owner would get nothing and Rent Ops would still record the rent as paid.

## Decision

- The commission is the accepted agent assignment's `commission_percentage` applied to the agreed amount, read from the property's assignment at quote time. No assignment, no commission.
- Any `agent_commission` sent by a client that disagrees with that figure is refused with `AMOUNT_INVALID`. The field is accepted only so older clients do not break.
- The commission goes to the agent's own non-personal organisation found from the assignment, never to a person.

## Why

Whoever pays must never decide how the money splits on the receiving side. The assignment is the one place the owner already agreed the agent's terms, so it is the only legitimate source. Taking the split out of the request also removes a whole class of tampering from the quote endpoint.

## Rejected

- Owner acceptance of the split on every route: correct but slower for direct payments, and still leaves the payer proposing the number.
- Recording rent paid as the owner's share instead of the agreed amount: wrong for the tenant's ledger, who did pay the full rent.

## Revisit when

Agent terms become per deal rather than per assignment (a negotiated commission in messaging); then the owner's explicit acceptance of that deal's split becomes the source. Related: [[2026-10-19-payout-accounts-are-owner-only-and-never-edited-in-place]], [[2026-10-19-review-money-paths-by-asking-who-gains]].
