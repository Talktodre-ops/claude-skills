---
date: 2026-10-08
tags: [local, django]
---

# The local API does not reload Python changes

## What happened

Code changes, including switching branches, did not take effect locally; tests passed but the running API served old code.

## Why it bit

gunicorn under supervisord runs without reload.

## The rule

After backend changes: `supervisorctl restart gunicorn` in `heimly-api-1`, and restart Celery.

## How to spot it next time

Behaviour that contradicts the code on disk.
