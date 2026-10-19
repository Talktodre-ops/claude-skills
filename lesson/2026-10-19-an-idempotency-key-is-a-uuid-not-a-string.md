---
date: 2026-10-19
tags: [frontend, idempotency, payments]
---

# An idempotency key is a UUID, not a string you can suffix

## What happened

The pay step needed two guarded calls from one user action, create the transaction and then start payment, so the web app sent the first key as given and the second as `<key>-pay`. The backend validates the header as a UUID and answered 400 `idempotency_key_invalid`, which the page showed as "Please refresh the page and try again." The mocked screenshots had passed because the mock did not validate the header; the real API did.

## Why it bit

The guard hook hands out one key per attempt; the natural way to get a second was to decorate the first. Nothing in the hook or the contract said the server checks the format, and the mock agreed with the guess.

## The rule

Every call that needs its own key gets its own key from the generator; never derive one. The server validates the header as a UUID and the contract says so. Mocks for a guarded endpoint validate the header too, or the mocked run proves nothing about it.

## How to spot it next time

A 400 with code `idempotency_key_invalid` or a generic "refresh and try again" on a second call inside one action; a key with a suffix in the network tab. See [[2026-10-19-review-money-paths-by-asking-who-gains]].
