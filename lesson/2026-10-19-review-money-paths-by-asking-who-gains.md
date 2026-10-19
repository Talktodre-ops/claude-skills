---
date: 2026-10-19
tags: [payments, security, review]
---

# Review money paths by asking who gains, before the builder's tests say green

## What happened

The payments backend landed with 95 passing tests, every state-machine row covered, HMAC webhooks, encrypted account numbers and idempotent actions. A read-only review of the same branch, briefed to look for who could move money to the wrong place, found six defects the tests had not asked about: an assigned agent could invite their own email as the owner's payout account and have the bank name matched against the name they typed; the payer could set the agent's commission up to the whole amount; the Paystack split was sent inside `metadata`, which the processor ignores; a payment that landed after a local cancel was marked processed and dropped; a confirm or auto-release read the state on an unlocked copy and could release past a dispute opened a moment earlier; a view-only member of the owner organisation could cancel a funded escrow.

## Why it bit

Builders test what the spec says should happen. Each of these was a path the spec did not name, found only by asking, for every input and every role, "what does this person gain if they lie here?" The split in metadata was a plain reading of the provider's docs that nobody checked against the request shape.

## The rule

Every money-moving branch gets a second read before merge, by someone who did not build it, briefed with the code and the threat table, not the builder's conclusions, and told to answer three questions per endpoint: who may call it, what can they put in it, and where does the money go if they lie. Inputs that decide a split (commission, recipient, account name) come from the system's own records, never from the caller. A provider request is checked field by field against the provider's documented shape, and anything unconfirmed is marked "to confirm in sandbox" in the code.

## How to spot it next time

An amount or recipient in a request body; a name match against a typed string; a provider field tucked into a free-form metadata object; a state read outside the lock that chooses the next move. See [[2026-10-19-agent-commission-comes-from-the-assignment-terms]] and [[2026-10-19-payout-accounts-are-owner-only-and-never-edited-in-place]].
