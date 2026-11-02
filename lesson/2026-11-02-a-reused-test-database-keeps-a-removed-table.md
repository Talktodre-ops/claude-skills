---
date: 2026-11-02
tags: [testing, database]
---

# A reused test database keeps a removed model's table

## What happened

After removing `PropertyAddressVerification`, three transactional Rent Ops tests failed with "cannot truncate a table referenced in a foreign key constraint" and a duplicate `landlord@heimly.test`. The test database is reused (`--reuse-db --nomigrations`), so the old table still pointed at `property_property`; the flush between transactional tests truncates only known models' tables, failed, and left rows behind.

## Why it bit

It looks like a broken test or a data bug, nowhere near the model that was removed.

## The rule

After removing or renaming a model, run `runtests.sh --create-db` once. Related: [[2026-10-19-a-rebuilt-test-database-has-no-row-level-security]].

## How to spot it next time

Truncate or duplicate-key errors in `transaction=True` tests right after a model change.
