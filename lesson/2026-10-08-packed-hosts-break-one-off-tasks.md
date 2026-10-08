---
date: 2026-10-08
tags: [aws, ecs, deploy, cost]
---

# Packed hosts break one-off tasks and leave rollouts scaled out

## What happened

After the cost cut packed two API tasks onto two t4g.medium hosts, the first production deploy failed before touching anything: the migration `run-task` asked for the API's full 1536 MB with `--launch-type EC2`, no host had more than 763 MB free, and ECS placed nothing (`task: None`). Fixed by running it through the service's capacity provider at 512 MB (BE #193). The rerun deployed, but the rollout scaled the ASG from 2 to 4 hosts, and it stayed at 4: the API's spread placement left a task on every host, so none was empty to scale in.

## Why it bit

`--launch-type EC2` bypasses the capacity provider, so ECS can neither wait for nor add a host. And managed scaling only removes empty hosts; spread placement makes sure none is.

## The rule

One-off tasks go through the capacity provider strategy with only the memory they need. After a cost cut that packs hosts, check how many hosts a rolling deploy leaves behind, not just that it succeeded.

## How to spot it next time

`run-task` returning no task (read its `failures`), or the ASG's desired count higher after a deploy than before.

Related: [[2026-10-08-instance-refresh-stalls-under-scale-in-protection]]
