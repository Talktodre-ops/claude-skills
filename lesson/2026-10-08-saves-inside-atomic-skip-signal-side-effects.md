---
date: 2026-10-08
tags: [django, transactions]
---

# Side effects fired inside a transaction miss rows that are not committed yet

## What happened

Renewal offers were invisible to tenants. The offer was created inside `transaction.atomic()`, its post_save signal queued a Celery indexing task at once, and the worker, on its own connection, looked the row up before the outer transaction committed, found nothing, and treated it as deleted. Intermittent, so most rows indexed and a few never did. First hit before 2026-10-04; the exact date was not recorded, so this file is dated when the lesson was written.

## Why it bit

The task ran in a different transaction from the one that created the row, and "not found" was read as "deleted" without a retry.

## The rule

Anything that leaves the transaction (indexing, MQTT publishes, emails, Celery tasks) goes through `transaction.on_commit`.

## How to spot it next time

Data present in the database but missing from a derived store.
