---
date: 2026-11-18
status: accepted
tags: [caching, nextjs, deploy, frontend, security]
---

# Browsers never store pages; every build has its own id

## Context

After pre-prod deploys on 17 and 18 November, Edge answered the first click on a page with the previous build's navigation data. The result was a crash or a false 404 until a reload ([[2026-11-18-the-browser-served-the-previous-builds-navigation-data]]). Next 16.3 sends prerendered pages and their RSC with `s-maxage` plus about a year of `stale-while-revalidate` (default `expireTime`). That default is meant for a CDN, and neither pre-prod nor production has one; production sends the same header.

## Decision

- **Browsers keep no copy of pages or navigation data.** A `headers()` rule in the web and admin `next.config.ts`, on `/((?!_next/static|_next/image).*)`, sends `private, no-cache, no-store, max-age=0, must-revalidate`. That is the value Next already sends for dynamic pages. Next only writes its own header when none is set, so the rule wins on every page. The server's own page cache keeps working (`x-nextjs-cache: HIT`).
- **Fingerprinted assets keep `public, max-age=31536000, immutable`.**
- **Every build carries a deployment id.** `NEXT_DEPLOYMENT_ID` is a Docker build arg: `github.sha` in the ECS workflow, so the arm64 and amd64 builds of one commit share it, and the build time on pre-prod. Next adds `?dpl=` to assets and turns a navigation that reaches another build into a full page load.
- **Safety nets:**
  - Try again on every error page is a full reload.
  - An error from loading code reloads once by itself, guarded to once a minute.
  - A 404 reached by a client-side navigation reloads once.

Shipped as FE #273, #274 and #275, all on pre-prod on 18 November.

## Why

The stale copy that broke Edge lived in the browser. Serving stale on the server is safe, because its cache only holds the running build. Serving stale in the browser is not, because its copy can come from any earlier build. Keeping nothing in the browser removes the cause, and it also keeps signed-in pages off shared disks.

What we give up is small. On a full load of a public page the browser asks the server every time: one request, answered from the server cache. In-app navigation stays instant through Next's in-memory router cache, prefetching, TanStack Query and hashed scripts on disk.

## Rejected

- **`expireTime: 3600` or `60`.** It shortens the browser's window but never closes it, and `expireTime` also sets when the server stops serving stale and makes a visitor wait.
- **`NEXT_PRIVATE_CDN_CONSUMED_SWR_CACHE_CONTROL`.** It splits the two cleanly, but it's an undocumented Vercel flag that could vanish silently on any upgrade.
- **`private, no-cache` (FE #274 as first shipped).** It replaced Next's `no-store` on dynamic pages ([[2026-11-18-a-header-rule-replaces-the-frameworks-own-header]]).
- **Waiting on the server instead of serving stale.** No safety gain: the server's stale copy is already the right build.

## Revisit when

CloudFront sits in front of the site ([[2026-11-18-cloudfront-stays-off-for-now]]). Public pages can then be cached at the edge for a short window, purged on every deploy, while browsers keep `no-store`.

Related: the `caching` skill in this repo, and the plan doc "Deploy-safe caching: asset retention and CDN plan" (https://claude.ai/artifact/8H56yPkGAGFAuw6ZQ3uUCe).
