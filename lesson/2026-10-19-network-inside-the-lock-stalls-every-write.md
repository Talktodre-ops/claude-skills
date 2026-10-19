---
date: 2026-10-19
tags: [payments, postgres, locks, celery]
---

# A network call inside a row lock stalls every other write on that row

## What happened

The webhook worker opened `transaction.atomic()`, locked the Transaction row, stamped it, and then called the provider's status API (15 s timeout) to confirm the event before moving state. Every user action on that transaction takes the same lock with a 3 s `lock_timeout`, so while the worker waited on the provider the user's accept or confirm failed with a lock error. In the same build, a transition's notices, emails and chat lines ran on the request after commit, so each write also carried the cost of everything that followed it.

## Why it bit

Holding a lock is cheap only while what happens under it is local. A provider round trip under the lock turns the row into a queue, and the lock timeout meant to fail fast turns into user-facing errors. Side effects on the request path make the request as slow as the slowest downstream.

## The rule

No network inside a transaction, ever: fetch from the provider first, then open the atomic block, lock, compare, write, commit. Everything that follows a state change (notices, emails, messages, metrics) is a task queued with `on_commit`, idempotent, stamped once, with a sweeper that re-runs it if the task is lost. The inbox claims an event with a status and a claim time, so a task and a sweeper never process the same event at once.

## How to spot it next time

`lock_timeout` errors on user actions while a worker is busy; a `requests.post` or `fetch_status` call between `atomic()` and the save; request durations that grow with the number of recipients or the presence of a linked conversation. See [[2026-10-19-side-effects-of-a-money-state-change-run-in-a-task-after-commit]] and [[2026-10-08-saves-inside-atomic-skip-signal-side-effects]].
