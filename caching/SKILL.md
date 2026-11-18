---
name: caching
description: How to cache a web app at every layer without ever serving the wrong version. Covers mapping every cache in the request path (browser disk cache, back/forward cache, the framework's in-memory router cache, client data caches like TanStack Query, the CDN, the server render cache, the server data cache), giving each class of response one explicit Cache-Control rule, and surviving deploys (version skew) with build ids, asset retention, safe switch-over points and recovery reloads. Distilled from a Next.js App Router app whose browsers served the previous build's navigation data after every deploy. Load when setting or reviewing Cache-Control or CDN rules, when a page breaks only on the first visit after a deploy, when choosing between waiting for fresh content and serving stale, when adding a CDN or object-storage asset host, or when a header change could weaken caching of signed-in pages. Framework-neutral principles; Next.js specifics in references/nextjs.md.
---

# Caching without serving the wrong version

Caching is not one thing. A request passes through as many as seven caches, each
with its own owner, lifetime and purge rule. Most caching bugs come from one of
them holding a copy longer than anyone meant, and deploys are where that shows:
the copy is from a build that no longer exists.

This skill is the map of those caches, one rule per kind of response, and the
defences that keep a deploy invisible. The running example is a Next.js app on
ECS with no CDN. After each deploy Chrome and Edge answered the first click on a
page with the previous build's navigation data, which crashed with
`Class extends value undefined` or showed a false 404 until a reload.

## 1. Map every cache in the path

Before changing any header, fill in this table for the app. Every row needs an
answer to: who writes it, how long it lives, how it is cleared, and what it holds
across a deploy.

| Layer | Holds | Lives in | Controlled by | Across a deploy |
|---|---|---|---|---|
| Browser HTTP cache | Any response the headers allow | The browser's disk | `Cache-Control` on each response | Keeps old copies; dangerous for anything unversioned |
| Back/forward cache | A whole page snapshot when leaving it | The browser's memory | Browser rules; `no-store` often excludes a page | Restores the snapshot as it was |
| Framework router cache | Visited and prefetched page data | The tab's memory | Framework settings (Next: `staleTimes`) | Gone on full load; the framework compares build ids |
| Client data cache | API results (TanStack Query, SWR, Apollo) | The tab's memory | `staleTime`, `gcTime`, invalidation | Gone on full load |
| CDN | Whatever its policy allows | Edge locations | CDN cache policy, `s-maxage`, purge | Keeps old copies until purged or expired |
| Server render cache | Rendered pages (ISR, full route cache) | The server or container | `revalidate`, tags | Safe if it lives in the build; must be keyed by build if shared |
| Server data cache | Query results, computed values | Redis, Valkey, memory | App keys, TTL, invalidation on write | Safe if the data shape did not change; version the keys if it did |

Two of these survive a deploy on the user's side: the browser HTTP cache and the
CDN. Those are where version bugs live.

## 2. Classify responses and give each class one rule

| Class | Example | Browser `Cache-Control` | Notes |
|---|---|---|---|
| Fingerprinted assets | `/_next/static/chunks/3466fv3bv45q9.js` | `public, max-age=31536000, immutable` | Safe forever only because the name changes with the content |
| Pages and navigation data | HTML, RSC, page JSON for client routing | `private, no-cache, no-store, max-age=0, must-revalidate` | The browser keeps no copy; freshness comes from the server or CDN |
| Signed-in API responses | `/api/me`, a user's deals | `private, no-store` | Never shared, never on disk |
| Public API responses | A public listing search | `no-store`, or a short `max-age` if measured to matter | Cache on the server instead (Redis), where you can invalidate |
| Unfingerprinted public files | `/logo.png`, `/manifest.webmanifest` | `public, max-age=0, must-revalidate`, or a short `max-age` | Rename the file when it changes if it must be cached long |
| Media by id | `/media/<uuid>.webp` | `public, max-age=31536000, immutable` if the id never gets new content | A new upload gets a new id |

Choosing between `no-cache` and `no-store` for pages:
- `no-cache` keeps a copy but re-checks it, which can save bytes with a `304`.
- `no-store` keeps nothing: no signed-in page left on a shared disk, and no snapshot from an old build.

Default to `no-store` for pages unless every page under the rule is public and the `304` saving has been measured to matter.

`stale-while-revalidate` must never reach a browser on a page or its navigation
data. Chromium honours it in its own cache, so a deploy keeps serving the old
version for up to that window. Frameworks emit it for CDNs (Next's default is about
a year); with no CDN in front, the browser is the only cache acting on it.

## 3. Deploys: defend in layers

A deploy changes the files and the code at once. Any client still holding the
old build, in a tab, a disk cache or a CDN, will ask the new servers for things
only the old build had. Defences, in the order to build them:

1. **The browser never reuses pages or navigation data** (section 2). This removes the most common cause.
2. **Every build has an id, and every asset and response carries it.**
   - In Next.js that's `deploymentId` / `NEXT_DEPLOYMENT_ID`.
   - Use the commit SHA, so the separate per-architecture builds of one commit share it.
   - The client then knows when it is talking to another build.
3. **The client switches at a safe moment.** When a navigation reaches another build, do a full page load instead of mixing code. Next does this when the ids differ.
4. **Old assets stay reachable.**
   - Keep every deploy's fingerprinted files in shared storage (object storage behind the CDN, or a host folder on a single box) for longer than a tab is likely to stay open: 30 days.
   - Upload before traffic moves, and never delete on deploy.
   - This also fixes rolling deploys, where old and new servers answer side by side for a minute. See `references/assets-and-cdn.md`.
5. **Recovery nets on the client:**
   - "Try again" on an error page is a full reload. Re-rendering keeps the broken modules, so it can never recover.
   - An error that comes from loading code reloads the page once by itself, guarded so a real bug cannot loop.
   - A "not found" reached by a client-side navigation reloads once. If the page exists it appears; if not, the 404 shows again.
6. **At scale, route by version during a rollout.**
   - Keep the old version up for a grace period (blue/green).
   - Route requests that carry the old build id to it, for example with a load-balancer rule on the id header.
   - Old tabs then never touch the new servers.
7. **Count every recovery per release.** One event per automatic reload, with its reason and build id. A release that raises the count is caught on its first day.

## 4. Decisions that come up

- **"Make the user wait or serve stale?"** Ask which cache. A server render cache only ever holds the running build, so serving its stale copy while it refreshes is safe and fast. A browser or CDN copy can come from any earlier build, so it must never be served stale across a deploy. Fix the browser and CDN layers; leave the server's stale-while-revalidate alone.
- **Framework knobs that couple layers.** Next's `expireTime` sets both the browser-visible `stale-while-revalidate` and when the server stops serving stale. Shrinking it trades server latency for a smaller, never-zero browser window. Set the browser header directly instead.
- **"Does turning off browser page caching make the app slow?"**
  - What makes an app feel instant is in-memory: the router cache, prefetching and the client data cache. On disk, it's fingerprinted assets.
  - None of these depend on the page's HTTP caching.
  - What you lose is one small request on a full page load, answered from the server cache.
- **When to add a CDN.**
  - For latency far from the origin, for offload at scale, or to hold an asset archive.
  - Price it from measured requests and bytes against the provider's free tier and plans, with live prices. Load the `grounded-research` skill; never quote CDN prices from memory.
  - A small app often fits inside a free tier.

## 5. Non-negotiables

- No `stale-while-revalidate` or `max-age` on pages or navigation data that reach a browser.
- No long-lived caching for any file whose name does not change with its content.
- A header rule that covers many paths is checked on every class it matches (prerendered, dynamic, signed-in, auth, API, assets), before and after, against what each sent before. When replacing a framework's header, use the strictest value the framework already sent.
- Signed-in pages and API responses are `no-store`.
- Builds of the same commit share one build id.
- Assets are uploaded before traffic moves to the new build, and never deleted on deploy.
- Caching changes are proven in a real browser with a real cache, never with request interception, which switches the cache off. See `references/verification.md`.

## 6. Diagnosing a stale-version bug

The signature:
- an error or a 404 on the first visit to a page after a deploy;
- a reload fixes it;
- often only one browser shows it.

Then:

1. Read the stack trace's file names. Fetch each from the server. A 404, or a name without the build query, means it came from a cache.
2. Check that the trace positions match the current files. A mix of current and missing files means two builds in one page.
3. `curl -sI` the page and its navigation request. Look for `stale-while-revalidate`, `s-maxage` with no CDN, or a missing build-id header.
4. In DevTools Network, "(disk cache)" against document or navigation requests confirms it.
5. Fix the header class first, then add the recovery nets.

## References

- `references/nextjs.md`: how Next 16 App Router writes `Cache-Control`, `expireTime`, `deploymentId`, the `_rsc` parameter, the router cache, and the code for the header rule, Docker build arg and recovery helpers.
- `references/assets-and-cdn.md`: the asset archive (S3 behind CloudFront, or a host folder behind nginx), cache behaviours, the lifecycle trap, upload ordering, edge and browser headers, version routing.
- `references/verification.md`: header checks per class, the deploy rehearsal in a real browser, and the testing traps.
- `references/heimly-practices.md`: the worked example. Heimly's server data cache (Redis keys, TTLs, versioned keys, invalidation on write), render cache and on-demand refresh, TanStack Query choices, how MQTT seeds the cache, and the rules we hold.

Related skill: `latency-tracing` for caching a hot server read without letting new data wait behind it.
