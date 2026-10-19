---
date: 2026-10-19
tags: [latency, neon, payments, measurement]
---

# Against a distant database the cost is round trips, and the slow-request log cannot see them

## What happened

On the local stack every payment action took 4 to 19 seconds: accept 7.2 s, mark delivered 18.8 s, confirm 10.8 s in the API's request log. The slow-request log for the same calls said about 2 s and "0 queries", which pointed away from the database. Timed in process, each round trip to Neon in us-east-1 cost about 0.29 s; accept made 19 trips, delivered 24 plus 15 more for a linked conversation. The query counter counts nothing inside an atomic block, which is where every payment write happens.

## Why it bit

Two measurement traps at once. The log that counts queries does not count the ones that matter here, so it blamed "work after the commit". And a request that is cheap in execution (15 to 21 simple statements) is expensive in distance when each statement is a transatlantic trip. Production's database sits beside the API, so the same code is fast there, which is why nobody had seen it before.

## The rule

Measure trips, not queries, and measure them where they run: a trace or an in-process timer around the view, with the database's real distance. Compare against the floor (one trip) before touching code. Before judging a write slow, know what one round trip costs on that machine; multiply by the trips a request must make for auth, organisation, idempotency, permissions, the locked state change and the answer. Reduce trips when they are redundant; accept them when they are the work. The slow-request log's query count is zero inside atomic blocks and must not be read as "no database time".

## How to spot it next time

Seconds in the request log with a handful of counted queries; a laptop against Neon; an action that is fast on pre-prod and slow locally. See [[2026-10-19-side-effects-of-a-money-state-change-run-in-a-task-after-commit]] and the `latency-tracing` skill.
