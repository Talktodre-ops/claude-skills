---
date: 2026-11-18
tags: [caching, nextjs, deploy, frontend]
---

# The browser served the previous build's navigation data

## What happened

On 17 November at 23:21 WAT, Edge showed "Something went wrong" on pre-prod `/sign-in` with `TypeError: Class extends value undefined is not a constructor or null`. After the next deploy (FE #273) it came back on other pages as `(0 , e.i(...).default) is not a function`. Clicking Dashboard and then Messages also gave a false 404. A reload fixed it every time; Firefox never showed it.

The stack traces named chunks (`060wboj3fjy7h.js`, `3_z00sj_-ku0v.js`, `0orxh9jmjn9-g.js`) that the live build did not contain and that answered 404 on the server. Edge loaded them from its own disk cache, without the build's `?dpl=` query, next to chunks from the current build.

The cause was the header Next 16.3 sends on prerendered pages and on their navigation data (RSC): `s-maxage=3600, stale-while-revalidate=31532400`. It comes from Next's default `expireTime` of one year and is meant for a CDN. We had none on pre-prod or production, so the browser was the only cache acting on it:

- Browsers ignore `s-maxage`, so the copy is stale on arrival.
- Chromium honours `stale-while-revalidate` and serves that stale copy for up to a year while it refreshes in the background.
- The `_rsc=` value on navigation requests hashes the router headers only, not the build id, so yesterday's entry matched today's request.

So the first click on each page after a deploy got the previous build's navigation data, which named the previous build's chunks. Ctrl+Shift+R did not help for long because it bypasses the cache only for the document; the navigation fetches after it went through the cache again.

Fixed the same night:

- FE #273: a deployment id per build (`NEXT_DEPLOYMENT_ID`, the commit SHA in CI). Try again does a full reload, and a code-load error reloads once by itself.
- FE #274: a `headers()` rule so browsers never reuse pages or navigation data. The code-load check also matches `e.i(...)`, and a 404 reached by a click reloads once.
- FE #275: the strict `no-store` value, after #274 had weakened it; see [[2026-11-18-a-header-rule-replaces-the-frameworks-own-header]].

A deploy rehearsal in Edge confirmed the fix: a persistent profile filled its cache on build A, the server swapped to build B, and 10 of 10 clicks landed on the right page.

## Why it bit

A framework default written for a CDN reached browsers directly. Nothing in the address changed between builds, so the browser had no reason to doubt its copy. The early guesses ("an old tab", "the page is not compiled yet") fitted the symptoms but not the stack trace, which named files the server did not have.

## The rule

Pages and navigation data must never be served from a browser's cache across deploys. Every response class gets an explicit `Cache-Control`; only fingerprinted assets get long-lived caching. A header with `s-maxage` or `stale-while-revalidate` on a document is a bug unless a CDN that we control and purge on deploy sits in front. See [[2026-11-18-browsers-never-store-pages]] and the `caching` skill.

## How to spot it next time

- An error or a 404 on the first visit to a page after a deploy, gone after a reload, in one browser only.
- A stack trace that names chunk files without the build query, or files that answer 404 on the server.
- DevTools shows "(disk cache)" against navigation requests (`?_rsc=`).
- `curl -sI` on a page shows `stale-while-revalidate` on a site with no CDN.
