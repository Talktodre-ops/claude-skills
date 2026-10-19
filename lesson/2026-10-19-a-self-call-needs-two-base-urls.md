---
date: 2026-10-19
tags: [payments, docker, django, webhooks]
---

# A service that calls itself needs an internal address and a public one, and the internal host allowed

## What happened

The fake escrow provider POSTs a signed webhook to our own API and builds a pay page link for the browser. Both used one setting, `PAYMENTS_SELF_BASE_URL`, first `http://localhost:8000`. From the Celery container localhost was not the API, so the webhook went nowhere. Set to `http://api:8000`, the webhook reached the API and Django refused it with `DisallowedHost: Invalid HTTP_HOST header: 'api:8000'`, and the pay page link given to the browser pointed at a hostname only containers can resolve.

## Why it bit

Three different things were folded into one URL: where a worker finds the API on the compose network, what hostname Django will accept, and what a person's browser can open. On a laptop they all happen to be "localhost" until the call comes from another container.

## The rule

Two settings: `PAYMENTS_SELF_BASE_URL` for service-to-service calls (the compose service name, `http://api:8000`) and `PAYMENTS_PUBLIC_BASE_URL` for anything a browser follows (`http://localhost` locally, the site origin on a server). Settings append the self URL's hostname to `ALLOWED_HOSTS` so a self-call is never refused. Any provider or fake that "calls us back" uses the self URL; any link it hands to a person uses the public one.

## How to spot it next time

A `DisallowedHost` with a compose service name in the API log, a webhook command that reports "0 events stored", or a redirect to `http://api:8000/...` in the browser. See [[2026-10-19-escrow-built-on-a-fake-provider-until-keys-arrive]] and [[2026-10-08-stale-nginx-upstream-shows-as-cors]].
