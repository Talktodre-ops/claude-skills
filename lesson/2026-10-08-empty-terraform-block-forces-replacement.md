---
date: 2026-10-08
tags: [terraform, aws, cloud-map]
---

# An empty Terraform block that AWS does not store means a replacement on every plan

## What happened

`health_check_custom_config {}` on the EMQX Cloud Map service was never stored by AWS, so every plan wanted to replace the service. The step 5 apply then failed: AWS refuses to delete a discovery service with a registered instance.

## Why it bit

Terraform compares config to what the API returns. An empty block the API drops reads as drift forever, and the replacement only fails late, mid-apply, after other resources already changed.

## The rule

Never add an empty block to satisfy a schema. After any apply, a second plan must say No changes; a resource that shows up every time is a config bug, not noise.

## How to spot it next time

The same `forces replacement` line on consecutive plans with no config change in between.

Related: [[2026-10-08-task-definition-defaults-churn]]
