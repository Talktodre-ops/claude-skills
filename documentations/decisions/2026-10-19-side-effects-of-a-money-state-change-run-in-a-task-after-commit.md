---
date: 2026-10-19
status: accepted
tags: [payments, celery, latency, architecture]
---

# Side effects of a money state change run in a task after the commit

Date: 2026-10-19. Status: accepted. Source: the live integration run (accept 7 s, mark delivered 19 s, confirm 11 s on the server) and the security review (a provider fetch inside the row lock).

## Context

The first build ran a transition's notices, emails, conversation lines and metrics on the request after the commit, and the event worker fetched the provider's status while holding the transaction's row lock. On this machine each round trip to Neon costs about 0.29 s, so a request with 15 to 21 trips plus a linked conversation's 15 more took up to 19 s, and user actions could hit the 3 s lock timeout while the worker waited on the provider.

## Decision

- Every side effect of a transition (notifications, emails, the system line in a conversation, the released-money metrics) runs in `payments.tasks.after_transition(transition_id)` on the payments queue, queued with `transaction.on_commit`. The request returns as soon as the state and its audit row are committed.
- The task is idempotent: `StateTransition.side_effects_done_at` is stamped once (the append-only rule allows exactly that one change), and a catch-up in the outbox sweeper re-runs any transition whose task never ran after two minutes.
- The escrow invitation and the step-up code email are tasks too. The provider's status is fetched before the atomic block, never inside it. The inbox claims an event with a PROCESSING status and a claim time, re-takeable after ten minutes, so a task and the sweeper never handle the same event twice.
- Action endpoints prefetch what the detail needs (participants, disputes, timeline) so the response is four queries, not ten.

## Why

A state change is a fact; what follows from it is work that can be retried. Keeping the work out of the request makes the write fast and makes a slow email server or broker a delay, not an outage. The stamp plus the sweeper is what makes "queued on commit" safe when a task is lost. The remaining local slowness is distance, not code: the same trips cost milliseconds against a co-located database.

## Rejected

- Answering actions with a summary instead of the detail to save trips: hides the real cost and makes the web app fetch twice.
- Running side effects synchronously but in parallel threads: the request still waits, and the lock problem stays.

## Revisit when

Round trips per action are reduced with a persistent connection and cached organisation lookups, or production traces show the payments queue falling behind. Related: [[2026-10-19-a-distant-database-makes-round-trips-the-cost]], [[2026-10-19-network-inside-the-lock-stalls-every-write]].
