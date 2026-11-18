---
date: 2026-11-18
tags: [caching, nextjs, security, headers]
---

# A header rule replaces the framework's own header

## What happened

FE #274 added a `headers()` rule in `next.config.ts` that sends `Cache-Control: private, no-cache` on every path except `/_next/static` and `/_next/image`. The aim was to stop browsers reusing prerendered pages across deploys ([[2026-11-18-the-browser-served-the-previous-builds-navigation-data]]).

Next only writes its own `Cache-Control` when none is set yet (`send-payload.js:60`: `if (cacheControl && !res.getHeader('Cache-Control'))`). So the rule also replaced the header Next sends on dynamic pages, `private, no-cache, no-store, max-age=0, must-revalidate`. After the deploy, `/sign-in` and the dashboard answered `private, no-cache`. Without `no-store` a browser may keep a signed-in page on disk and show it from Back after sign-out.

The deploy rehearsal had printed `/sign-in | cache-control private, no-cache`, and nobody flagged it. The check after the pre-prod deploy caught it, and FE #275 changed the rule to Next's strict value the same night.

## Why it bit

The rule was written and tested for the page class it was meant for (prerendered pages). The pages that already had a stricter header were in the same path pattern, and the verification printed their header without comparing it to what they sent before.

## The rule

A blanket header rule changes every page class it matches. Before merging, list each class the pattern covers (prerendered, dynamic, signed-in, auth, API, assets) and diff its header before and after. When replacing a framework's header, use the strictest value the framework already sent for any of those classes.

## How to spot it next time

A header change where the verification shows one value for every page: if dynamic and prerendered pages used to differ, one of them just changed. Run `curl -sI` on a signed-in or auth page before and after any header rule and compare.
