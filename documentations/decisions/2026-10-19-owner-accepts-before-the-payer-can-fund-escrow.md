---
date: 2026-10-19
status: accepted
tags: [payments, escrow, product]
---

# The owner side accepts before the payer can fund escrow

Date: 2026-10-19. Status: accepted. Source: found in the live integration run (a tenant's first Pay answered NOT_ACCEPTED) and kept as the rule.

## Context

A tenant can start a Buyer's Protection payment from the pay screen. Escrow binds both sides: the owner agrees to be paid through a hold, to a confirmation window and to a dispute process. The first live run showed the backend already refused funding before acceptance; the web app had no explanation and the pay screen was a dead end.

## Decision

- A payer-made escrow transaction is CREATED and waits for the owner side (the owner organisation or its assigned agent with the right to act) to accept. Only then can the payer fund it. Direct payments need no acceptance.
- The quote says `acceptance_required: true` for escrow, the pay screen explains it before Pay ("Okafor Properties has to accept Buyer's Protection for this payment first. We will tell them now and you can pay from your Money page once they do."), Pay creates the transaction and lands on its detail, the detail shows "Waiting for Okafor Properties to accept", and "Pay now" appears once accepted.
- The owner-side acceptance screen names the amount, who pays, the window in hours and that the partner holds the money until the payer confirms. Declining falls back to direct payment with the notice that Heimly cannot step in on payments outside escrow.

## Why

Money that lands in a hold the recipient never agreed to cannot be released on the recipient's terms, and the recipient's payout account has to be verified before any quote names them. Making acceptance explicit also gives the owner side the moment to invite an owner who is not on Heimly to add their account.

## Rejected

- Letting the payer fund first and asking the owner afterwards: a refund path for every declined deal, and fees lost on each.
- Treating the listing as implicit acceptance: the agreed price and the split are per deal, not per listing.

## Revisit when

Deals in messaging ship: acceptance can then be the owner's action on the deal card in the conversation, and the pay screen's explanation becomes a system line. Related: [[2026-10-19-no-funded-wallet]], [[2026-10-19-agent-commission-comes-from-the-assignment-terms]].
