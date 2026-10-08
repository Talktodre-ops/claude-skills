---
date: 2026-10-08
tags: [testing, security, rls]
---

# A leak test proves nothing without a control run and a role RLS applies to

## What happened

Proving the pooled RLS rework: the probe ran 9,600 concurrent checks through PgBouncer with 0 wrong. Run as a superuser it would have passed regardless (superusers bypass RLS), and without a control it could have been unable to fail. Connected as a plain role and rerun with the old session-level code, it showed 9,246 of 9,600 wrong.

## Why it bit

A security test that cannot fail looks exactly like one that passes.

## The rule

For any isolation test: connect as the role production uses (not a superuser, not BYPASSRLS), and run once against the known-bad version to see it fail.

## How to spot it next time

A green security test that was never seen red.

Related: [[2026-10-08-session-state-leaks-through-transaction-pooling]]
