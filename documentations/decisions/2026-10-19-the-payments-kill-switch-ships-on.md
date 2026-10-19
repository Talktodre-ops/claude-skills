---
date: 2026-10-19
status: accepted
tags: [payments, feature-flags, operations]
---

# The payments kill switch ships ON, like every other kill switch

Date: 2026-10-19. Status: accepted. Source: found while running the feature-flag tests on the payments branch.

## Context

The contract named the kill switch `payments_kill`, seeded OFF, with ON meaning stop. The flag service treats every flag not in `KILL_SWITCHES` as ON wherever `FEATURE_FLAGS_DEFAULT_ON` is set (local and pre-prod), so a kill flag outside that tuple would have read as "kill" in both and renewals would never have run there. The existing kill switches (`paystack`, `qoreid`, `email`) all ship ON and turning one OFF is the emergency action, and the flag tests assert exactly that for every name in the tuple.

## Decision

- The payments kill switch is `payments_live`: in `KILL_SWITCHES`, seeded ON by its migration, and turning it OFF stops new quotes, payments and subscription renewals. It never blocks webhooks, reads, or releases already due.
- `payments` (the section and direct payments) and `payments_escrow` (the hold) ship OFF and are turned on by allowlist first, as ordinary feature flags.
- One migration (`payments.0004`) seeds `payments_live` and removes the earlier `payments_kill` row.

## Why

A kill switch whose ON means "working" and OFF means "stop" is the convention the service, the seeds and the tests already encode; a flag with the opposite meaning would need its own exception in every place that reads flags, and the default-on behaviour would have silently paused payments on pre-prod. One convention, read one way, is the safest thing on an emergency path.

## Rejected

- Adding `payments_kill` to `KILL_SWITCHES` with inverted meaning: the tests and the operator's mental model both say a kill switch that is ON is a service that is on.

## Revisit when

The flag model grows a `kind` so kill switches and feature flags are different rows rather than a tuple of names. Related: [[2026-08-28-feature-flags-d7]], [[2026-10-19-a-kill-flag-outside-the-kill-tuple-reads-as-on]].
