---
date: 2026-10-08
tags: [aws, alb, emqx]
---

# A load balancer's drain delay is downtime for a single task deployed stop first

## What happened

EMQX runs one task and deploys 0/100 (stop before start). The wss target group kept the AWS default 300 second deregistration delay, so every EMQX redeploy left new chat connections without a broker for five minutes (09:27:49 to 09:33:58).

## Why it bit

The default assumes a replacement is already serving while the old one drains. With one task stopped first, the drain is pure waiting.

## The rule

For any single-task, stop-first service behind a target group, set `deregistration_delay` to seconds (EMQX: 15).

## How to spot it next time

A redeploy where running count sits at 0 and the target shows `draining` for minutes.
