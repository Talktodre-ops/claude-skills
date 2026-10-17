---
date: 2026-10-17
tags: [testing, performance]
---

# A test stand-in must outsize the part it replaces

## What happened

The first load test on the prod-sized copy returned 500s. They came from the nginx standing in for the ALB: it ran out of file descriptors, then marked both API containers down.

## Why it bit

The stand-in had default limits. The real load balancer has neither problem, so the run measured the test rig.

## The rule

Every stand-in in a test rig gets limits far above the load: file descriptors, connections, no marking targets down, no retries. Check its logs before believing any failure.

## How to spot it next time

Errors with nothing in the app's logs. See [[prod-mimic]].
