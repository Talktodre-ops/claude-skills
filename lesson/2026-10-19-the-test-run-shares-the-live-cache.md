---
date: 2026-10-19
tags: [testing, redis, feature-flags]
---

# The test run shares the live stack's cache, so a busy app leaks into pytest

## What happened

`test_me_endpoint_delivers_flags` failed in a combined run with `KeyError: 'payments_live'` and passed when run alone. `runtests.sh` only overrides the database variables, so pytest inside the API container reads and writes the same Redis the live API uses. An integration script was driving the web app at the time; the live API kept repopulating the flag cache key between the test fixture's seed and the test's read, and the test saw the live app's flag map.

## Why it bit

The test database is isolated; the cache is not. Any test that reads something the live app also caches (flags, help topics, pricing) is at the mercy of whoever is clicking around, and the failure looks like a code defect in the thing that was just changed.

## The rule

Fixtures that seed cached rows invalidate the cache after seeding and after deleting (the kill-switch fixtures now do). When a test flakes only while the stack is busy, suspect the shared cache before the code. The proper fix, still to do, is a cache key prefix for the test run in `runtests.sh`.

## How to spot it next time

A KeyError or stale value for a row the fixture clearly created; passes alone, fails in a batch; someone was using the local app at the time. See [[2026-10-08-worktree-test-runner-differs-from-the-api-container]].
