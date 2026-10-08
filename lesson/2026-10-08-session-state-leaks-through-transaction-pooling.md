---
date: 2026-10-08
tags: [postgres, pgbouncer, security, rls]
---

# Session-level settings leak between users through a transaction pooler

## What happened

RLS sets `app.current_user_id` with `set_config(..., false)`, which lives for the connection. Behind PgBouncer in transaction mode the next transaction on that server connection may be another user's, carrying the first user's id. Caught at design time, before any pooler was added.

## Why it bit

Persistent connections hid it: one Django thread owned one connection, so the value was always ours.

## The rule

Anything that must not cross users is transaction-local (`set_config(..., true)` sent with the statement). Audit for session state (SET, advisory locks, LISTEN, server-side cursors, prepared statements) before putting a transaction pooler in front.

## How to spot it next time

Any `set_config(..., false)`, `SET` without `LOCAL`, or `.iterator()` on a pooled connection.

Related: [[2026-10-08-production-runs-on-two-graviton-hosts]]
