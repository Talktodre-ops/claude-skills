---
date: 2026-10-17
tags: [performance, gunicorn]
---

# Make requests cheaper and request-counted limits fire more often

## What happened

After the hasher and cache fixes, the prod-sized copy was clean to 3,000 requests a minute, then p99 jumped to 1 to 9 seconds at 4,000 while the API sat at about 15% CPU. Every spike lined up with gunicorn's "Autorestarting worker" lines.

## Why it bit

`--max-requests 1000` had been sized for slow requests. Four times cheaper requests meant a worker somewhere restarted every 15 seconds, and each fresh worker's first requests stalled its neighbours on half a core.

## The rule

When a change makes requests cheaper, re-check every limit counted in requests rather than time. We moved to `--max-requests 10000 --max-requests-jitter 1000`.

## How to spot it next time

Latency spikes in bursts at low CPU. Line them up with worker restart and boot log lines. See [[prod-mimic]] and [[2026-10-17-api-capacity-from-a-calibrated-copy]].
