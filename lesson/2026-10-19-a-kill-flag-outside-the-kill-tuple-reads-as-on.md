---
date: 2026-10-19
tags: [feature-flags, payments, pre-prod]
---

# A kill flag outside the kill tuple reads as ON wherever flags default on

## What happened

The payments contract defined `payments_kill`: a flag seeded OFF whose ON meant "stop payments". The auto-renew builder noticed that `FeatureFlagService.enabled()` returns True for any name not in `KILL_SWITCHES` when `FEATURE_FLAGS_DEFAULT_ON` is set, which is the case locally and on pre-prod. The renewal task checked `enabled('payments_kill')` and would have logged "paused" on every run there, forever, with no row ever turned on. The flag tests then failed for a second reason: they assert that every name in `KILL_SWITCHES` is seeded ON by migration, because that is what a kill switch means here.

## Why it bit

Two conventions collided: a flag whose ON means "working" (how the service, the seeds and the tests read kill switches) and a flag whose ON means "stop" (how the contract was written). The default-on setting turned the second kind into a permanent stop.

## The rule

A kill switch is a flag that ships ON and is turned OFF to stop something; its name says what is live (`paystack`, `email`, `payments_live`), it is in `KILL_SWITCHES`, and its migration seeds it ON. Never introduce a flag whose ON means off. Any code path that pauses on a flag reads `not enabled('<thing>_live')`.

## How to spot it next time

A flag name ending in `kill`, `off` or `paused`; a test in `test_feature_flags.py` failing with a KeyError or DoesNotExist on a new name; a task that logs "paused" on an environment where nobody paused it. See [[2026-10-19-the-payments-kill-switch-ships-on]] and [[2026-08-28-feature-flags-d7]].
