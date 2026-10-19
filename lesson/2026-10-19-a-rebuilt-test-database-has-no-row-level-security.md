---
date: 2026-10-19
tags: [testing, postgres, rls]
---

# A test database rebuilt without migrations has no row-level security policies

## What happened

After `runtests.sh --create-db` for the payments models, the broad run came back 2424 passed and one failed: `test_the_policy_shows_a_user_only_their_own_cards` saw both users' saved cards. `pytest.ini` runs with `--nomigrations`, and the policies on `account_savedcard` only exist in migrations 0036, 0038 and 0039, so the rebuilt `test_heimly_test` had `relrowsecurity` false and an empty `pg_policies`. The test had passed before only because the old test database had been created with migrations long ago and reused ever since.

## Why it bit

`--nomigrations` builds tables from the models and skips every `RunSQL`; row-level security, triggers and policies are exactly the things that live only in SQL migrations. The payments app avoided this by applying its own trigger SQL in a session fixture; the older RLS test has no such fixture.

## The rule

A test that depends on database rules written in a migration must install those rules itself (a session fixture that runs the migration's SQL), or it is a test of the reused database, not of the code. After any `--create-db`, treat that one RLS failure as environmental until the fixture exists.

## How to spot it next time

A policy or trigger test failing right after `--create-db` with every other test green; `pg_policies` empty on the test database. See [[2026-10-08-a-leak-test-needs-a-control-and-a-plain-role]].
