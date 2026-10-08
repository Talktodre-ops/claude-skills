---
date: 2026-10-08
tags: [aws, ecs, asg]
---

# An Auto Scaling instance refresh stalls under ECS managed termination protection

## What happened

Moving production from t3 to t4g hosts, the instance refresh launched new hosts and then waited forever: every old host was protected from scale-in because it still ran tasks, and the refresh would not terminate a protected instance. EMQX was down about six minutes (08:21 to 08:27) while it was cancelled and the hosts moved by hand.

## Why it bit

Managed termination protection and instance refresh both own the decision to remove a host, and protection wins. Nothing in the plan or the console warns you.

## The rule

Move ECS hosts by draining, one at a time: raise the group's max if room is needed, set the old container instance to DRAINING, wait for 0 running tasks, remove its scale-in protection, terminate it with `--should-decrement-desired-capacity`.

## How to spot it next time

A refresh sitting at the same percentage for minutes while the old instances still show `ProtectedFromScaleIn: true`.

Related: [[2026-10-08-production-runs-on-two-graviton-hosts]]
