---
date: 2026-10-08
tags: [postgres, django, transactions]
---

# A statement prefix must never touch transaction control

## What happened

The pooled-RLS rework sent `SELECT set_config(...); <statement>` for every statement, including Django's `ROLLBACK TO SAVEPOINT`. After a constraint error the transaction refuses everything but a rollback, so the prefix failed, the rollback never ran, and every `atomic()` that catches an `IntegrityError` broke (19 tests: idempotency, rent ops, sales).

## Why it bit

Django sends savepoint commands through the same cursor and wrappers as queries.

## The rule

A wrapper that rewrites SQL passes transaction control (`SAVEPOINT`, `RELEASE`, `ROLLBACK`, `COMMIT`, `BEGIN`) and statements that cannot run in a transaction block through untouched, and has a test for a caught `IntegrityError` inside an outer `atomic()`.

## How to spot it next time

`TransactionManagementError: An error occurred in the current transaction` right after an expected `IntegrityError`.

Related: [[2026-10-08-session-state-leaks-through-transaction-pooling]]
