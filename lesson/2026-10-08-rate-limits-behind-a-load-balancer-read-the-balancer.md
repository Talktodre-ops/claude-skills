---
date: 2026-10-08
tags: [security, django, aws]
---

# An IP rate limit behind a load balancer counts the balancer

## What happened

django-ratelimit's `key='ip'` reads `REMOTE_ADDR` unless `RATELIMIT_IP_META_KEY` is set. Behind the ALB that is the balancer node, so in production register was 5 an hour and login 10 per 5 minutes for the whole site per node. Found while planning for ad bursts; 30 days of logs showed no real person refused yet, only one test client.

## Why it bit

DRF's throttles were configured with `NUM_PROXIES`; the second limiter in the same code path had its own, unset, idea of the client.

## The rule

Every component that keys on the client address reads it the same way (`core.client_ip`, NUM_PROXIES from the right). Per-IP limits are ceilings sized for a carrier IP; per-account protection is per address. Changing the proxy chain (CloudFront) changes NUM_PROXIES in the same release.

## How to spot it next time

Two different users refused together, or a limit far below what one person could hit.
