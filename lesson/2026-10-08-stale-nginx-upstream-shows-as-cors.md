---
date: 2026-10-08
tags: [local, docker, debugging]
---

# A stale nginx upstream shows up in the browser as a CORS error

## What happened

After recreating the api container, every call 502'd at nginx, and the browser reported CORS failures because the 502 carries no CORS headers.

## Why it bit

nginx resolved the old container IP at start and kept it.

## The rule

After recreating `api`, restart nginx. Treat a sudden CORS error locally as a possible 502 first.

## How to spot it next time

CORS errors on every endpoint at once.
