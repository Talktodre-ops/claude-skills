---
date: 2026-10-08
tags: [production, safety]
---

# A dry run against production is a real run with a typo away

## What happened

Testing the new Celery rollout script, the write commands were swapped for `echo` by text substitution. One swap missed on indentation and `aws ecs update-service` really ran against the production worker with a dummy task definition. AWS rejected it; nothing changed.

## Why it bit

The safety relied on a string replace succeeding, and nothing checked it had.

## The rule

Do not run scripts against production to test them. Test the read half by itself, or against a non-production cluster; if a script must touch prod, review the exact command first and run it once, deliberately.

## How to spot it next time

Any test harness that edits a production script's text to make it safe.
