---
date: 2026-10-19
status: accepted
tags: [payments, escrow, testing, providers]
---

# Escrow is built on a fake provider until Payscrow keys arrive

Date: 2026-10-19. Status: accepted. Source: Dre: "no payscrow keys yet, build against the fake provider and go".

## Context

The business has signed with Payscrow but no sandbox keys exist. The spec's Phase 0 was a sandbox spike before any production code. Dre wanted the whole payment infrastructure built end to end now.

## Decision

- `PAYMENTS_ESCROW_PROVIDER` is `fake` whenever `PAYSCROW_API_KEY` is empty and `payscrow` only when it is set. The fake refuses to load outside DEBUG unless `PAYMENTS_ALLOW_FAKE_PROVIDER` is true, and the public dev secret is refused outright once the provider is `payscrow`.
- The fake behaves like Payscrow, not like a stub: it keeps state in its own table, serves a pay page with Pay, Fail and Abandon buttons, quotes a fee, and every state change POSTs a webhook to our own endpoint signed with the real HMAC scheme and headers, so the inbox, the verify-by-fetch rule and the sweepers are exercised for real. A management command fires any event (`funded`, `settled`, `refunded`, `dispute:<stage>`) from a shell or an e2e script.
- The Payscrow adapter is written from the vendor document and covered by tests against recorded shapes, but every path other than the create call and the field names are marked as assumptions pending the sandbox spike. It is never selected until a key exists.
- The fake sends its webhook through `PAYMENTS_SELF_BASE_URL` (an internal service address) and builds the pay page on `PAYMENTS_PUBLIC_BASE_URL` (what a browser can reach).

## Why

The expensive parts of payments are the state machine, the ledger, the inbox and outbox, the permissions and the screens; none of them need the real provider to be built and proven. A fake that signs real webhooks to the real endpoint exercises the same code the real provider will, so swapping the adapter in later is a configuration change plus the spike's corrections, not a rebuild. Keeping the fake behind an explicit flag outside DEBUG means it cannot be selected in production by accident.

## Rejected

- Waiting for keys: weeks of idle time on the largest build of the phase.
- A stub that returns canned results in process: would skip the webhook path, which is where most payment bugs live.

## Revisit when

Keys arrive: run the spike in `.agents/loops/escrow-build.md`, write the answers back, and correct the adapter before the first ₦100 dress run. Related: [[2026-10-05-escrow-runs-on-payscrow-inside-one-walled-off-app]], [[2026-10-19-a-self-call-needs-two-base-urls]].
