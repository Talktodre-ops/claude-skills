---
date: 2026-10-19
tags: [process, agents, docker]
---

# A long build must survive a reboot: commit in slices and know which containers come back

## What happened

The payments build ran as four parallel builders. The session restarted once and the machine rebooted once (kernel update). Both times two builders were cut off mid-way with hours of uncommitted work on disk; the work survived because it was on the filesystem, but each builder had to be resumed by hand with a message describing what was left. After the reboot `postgres-test` did not come back (restart policy respects a manual stop), so the first test run of every resumed builder would have failed.

## Why it bit

Builders were briefed to commit "as you go" but did large slices; a restart found whole apps uncommitted. The compose stack's test database and the search container have a restart policy that honours a manual stop, so a reboot leaves them down while the rest of the stack returns.

## The rule

Brief every builder to commit a coherent slice at least every item of its list, with the resume state in the commit history, not in its head. After any restart: `docker compose up -d postgres-test` (and `opensearch` if it is in the stack), check `git status` on every branch before resuming, and resume each builder with the exact files on disk and the commits that landed meanwhile.

## How to spot it next time

A task notification saying agents did not finish before the previous session ended; `uptime` under a few minutes; a test run that cannot reach `postgres-test`. See [[2026-10-08-the-api-container-does-not-reload]].
