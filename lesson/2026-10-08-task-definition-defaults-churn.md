---
date: 2026-10-08
tags: [terraform, ecs, celery]
---

# ECS task definitions churn when the config omits defaults AWS fills in

## What happened

Every prod plan replaced all four task definitions because AWS stores `essential`, empty `mountPoints`/`portMappings`/`systemControls`/`volumesFrom`, `hostPort` and the FireLens router's `user = "0"`, which the config left out. Each apply then fired the Celery rollout triggers, which moved Celery onto Terraform's `:latest` revision and undid the backend deploy's `sha-<commit>` pin.

## Why it bit

We called it noise and lived with it for weeks. Noise that triggers provisioners is not noise.

## The rule

State the defaults AWS stores. A provisioner that rolls a service must keep the image the service is running, not the one in the Terraform revision.

## How to spot it next time

A plan that always replaces task definitions; a service running `:latest` when the deploy pushed a sha.

Related: [[2026-10-08-empty-terraform-block-forces-replacement]]
