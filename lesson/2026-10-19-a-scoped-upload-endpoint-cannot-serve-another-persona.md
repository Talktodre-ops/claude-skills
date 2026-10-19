---
date: 2026-10-19
tags: [payments, rent-ops, permissions, uploads]
---

# An endpoint scoped to one persona cannot be borrowed for another

## What happened

Dispute evidence reused the Rent Ops document upload (`rent-ops/documents/upload-url/`) because it already handled storage and scanning. A tenant reporting a problem got 404 "We could not find that. It may have been removed." on the first request: the Rent Ops endpoint scopes everything to a landlord or agent organisation, and a tenant's personal organisation is not one. The feature worked for the owner side and silently excluded the payer, who is the person most likely to need it.

## Why it bit

Reuse looked free because the storage and scanning were right; the scoping rule, which lives in the view and not in the storage service, was the part that did not fit. The mocked screenshots never hit the real endpoint.

## The rule

Reuse a service, not a view. Payments owns its own evidence endpoint that accepts the file, applies the payment's own permission rule (payer or owner side), and calls the same storage and scanning path underneath. Any endpoint reused across personas is tried as each persona on the real API before it ships.

## How to spot it next time

A 404 or 403 from an endpoint under another feature's URL prefix when a different persona calls it; a "reuse" that imports a view's URL rather than a service function. See [[2026-10-19-review-money-paths-by-asking-who-gains]].
