---
date: 2026-10-19
status: accepted
tags: [payments, security, beneficiaries]
---

# Payout accounts are owner-only, verified against the owner's name, and never edited in place

Date: 2026-10-19. Status: accepted. Source: the security review of the payments branch (an assigned agent could redirect the owner's whole payout) and the live run (a change between quote and pay must not move money or rewrite history).

## Context

An agent can list for an owner who is not on Heimly. The first build let the agent send a payout invite to any email, matched the bank's name against whatever the submitter typed, and let the newest verified invited account win for the owner's share. Accounts were also edited in place, so a change after a quote would pay a different account than the one the payer saw.

## Decision

- An invite for the owner's share goes only to the owner organisation's registered contact on file, never to a free-text address. A different address is refused (`INVITE_RECIPIENT`).
- The account name from the bank's name enquiry must match the owner organisation's name or its owner's legal name at the existing 0.82 rule. The typed name is never used.
- A verified account is never replaced by a later invite (`LOCKED`). A change creates a new Beneficiary row and marks the old one SUPERSEDED; participants keep the row they were created with, so past payments keep showing the account they were paid to.
- Every add or change starts a 24 hour cooling off during which no payout goes to the account, the first add included, and the owner organisation's owner and admins are told.
- An agent can never create or edit the beneficiary that receives the owner's share. Account numbers are encrypted at rest and only the last four digits leave the server.

## Why

The owner's money must only ever go to an account that the owner's own identity can be matched to, through a channel only the owner controls. Supersede instead of edit keeps the ledger honest: a row that participants point at must describe the account that was paid. Cooling off turns an account takeover into a day's delay with a notice to the previous contact instead of an instant loss.

## Rejected

- Letting an owner-org member approve an invited account instead of restricting the recipient: adds a step and still leaves the agent choosing the address.
- Exempting the first add from cooling off: convenient, but the first add is exactly when an invited stranger could be the one adding it. Flagged for Dre to reverse if he wants.

## Revisit when

A verified owner identity (NIN or CAC through the existing KYC) can be bound to the bank account at the provider, making the name match redundant. Related: [[2026-10-19-agent-commission-comes-from-the-assignment-terms]], [[2026-10-19-review-money-paths-by-asking-who-gains]].
