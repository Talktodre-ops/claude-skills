---
date: 2026-10-17
tags: [performance, security, django]
---

# Library defaults assume a machine you may not have

## What happened

Registration took 780 ms and half of all API CPU at 30 sign-ups a minute. Django 5.2's Argon2 defaults (100 MiB, 2 passes, 8 lanes) were running on a task with half a core and 1.5 GB; about ten hashes at once could have run it out of memory.

## Why it bit

Nobody had read the hasher's defaults against the task's size. Eight lanes assume eight cores; 100 MiB per hash assumes memory to spare.

## The rule

Read the cost parameters of every deliberately slow primitive (password hashing, image work, PDF rendering) against the CPU and memory of the container that runs it. We moved to OWASP's minimum (19 MiB, 2, 1): 85 ms and 19 MB. A custom Django hasher must replace the stock entry, since both answer to `argon2`.

## How to spot it next time

One rare write endpoint dominating server time in a per-endpoint breakdown. See [[2026-10-17-api-capacity-from-a-calibrated-copy]].
