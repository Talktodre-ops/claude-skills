---
date: 2026-10-17
tags: [production, aws, gunicorn]
---

# The app's keep-alive must outlast the load balancer's idle timeout

## What happened

Production logged 2 to 3 ELB 502s every day for a week with nothing in the app's logs. gunicorn ran `--keep-alive 5`; the ALB's idle timeout was 60 s.

## Why it bit

gunicorn closed idle connections after 5 s. The ALB, still holding them for 60 s, sometimes sent the next request down one that had just closed, and answered 502.

## The rule

Behind any proxy, the server's keep-alive is longer than the proxy's idle timeout, so the proxy always closes first. We run `--keep-alive 65`. AWS gives the same advice in its ALB docs.

## How to spot it next time

A low, steady trickle of `HTTPCode_ELB_502_Count` with no matching app errors. See [[2026-10-17-api-capacity-from-a-calibrated-copy]].
