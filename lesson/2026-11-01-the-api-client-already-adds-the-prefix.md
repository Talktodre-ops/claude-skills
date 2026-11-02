---
date: 2026-11-01
tags: [frontend, api]
---

# The API client already adds `/api/v1`

## What happened

The first listing draft service used `/api/v1/properties/listing-draft/` as its base with the shared `api` client, which already prefixes `/api/v1`. Every call went to `/api/v1/api/v1/...` and returned 404, found in the Edge run.

## Why it bit

Two clients live side by side: `fetchWithAuth` takes full URLs, `api` takes paths after `/api/v1`.

## The rule

With `api` from `@/lib/api`, write paths like `/properties/listing-draft/`; with `fetchWithAuth`, build `${API_BASE_URL}/api/v1/...`.

## How to spot it next time

A 404 on a route that exists, with `/api/v1` twice in the network tab.
