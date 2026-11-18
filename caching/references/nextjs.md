# Next.js App Router: caching and deploys

Read from Next 16.3.6's own source and bundled docs (`node_modules/next/dist`),
November 2026. Re-check the cited files after a Next upgrade; these are internals.

## How Next writes Cache-Control

`dist/server/lib/cache-control.js`:

```js
function getCacheControlHeader({ revalidate, expire }) {
  const swrHeader = typeof revalidate === 'number' && expire !== undefined && revalidate < expire
    ? `, stale-while-revalidate=${expire - revalidate}` : '';
  if (revalidate === 0) return 'private, no-cache, no-store, max-age=0, must-revalidate';
  else if (typeof revalidate === 'number') return `s-maxage=${revalidate}${swrHeader}`;
  return `s-maxage=${CACHE_ONE_YEAR_SECONDS}${swrHeader}`;
}
```

- **Dynamic pages** get `private, no-cache, no-store, max-age=0, must-revalidate`.
- **Prerendered and ISR pages, and their RSC navigation data,** get `s-maxage=<revalidate>, stale-while-revalidate=<expire - revalidate>`. A page with `revalidate = 60` sends `s-maxage=60, stale-while-revalidate=31535940`.
- **`expire` comes from `expireTime`, default `31536000` (one year)** (`config-shared.js`). Next's docs describe it as the stale-while-revalidate time "for CDNs to consume".
- **`expireTime` is not header-only.** It also sets when the server's incremental cache stops serving a stale entry and forces a blocking render (`incremental-cache/index.js`: "If the route's `expire` time has passed, force a blocking revalidation"). It is also the default `expire` of `cacheLife`. Shrinking it to protect browsers makes visitors wait on the server.
- **`NEXT_PRIVATE_CDN_CONSUMED_SWR_CACHE_CONTROL`** drops the browser part only. It is an undocumented Vercel flag; do not build on it.

`dist/server/send-payload.js:60`:

```js
if (cacheControl && !res.getHeader('Cache-Control')) {
  res.setHeader('Cache-Control', getCacheControlHeader(cacheControl));
}
```

So a header set earlier, by a `headers()` rule in `next.config`, wins on every
page it matches: prerendered and dynamic alike. That is how to control the
browser header without touching the server cache, and also how to accidentally
weaken a dynamic page's `no-store`.

## The header rule

```ts
// next.config.ts
async headers() {
  return [
    // Pages and navigation data: the browser never keeps a copy. Next's own
    // header on prerendered pages (s-maxage plus a year of stale-while-revalidate)
    // is meant for a CDN. This is the value Next itself sends for dynamic pages,
    // so dynamic pages are unchanged. Hashed assets keep long-lived caching.
    {
      source: '/((?!_next/static|_next/image).*)',
      headers: [
        { key: 'Cache-Control', value: 'private, no-cache, no-store, max-age=0, must-revalidate' },
      ],
    },
    // ...security headers rules
  ];
},
```

Verified in production images:
- `/` and other ISR pages still report `x-nextjs-cache: HIT` (the server cache is untouched);
- `/_next/static/*` keeps `public, max-age=31536000, immutable`;
- navigation responses (`?_rsc=`) carry the rule's value.

**With a CDN in front:** don't let this rule be the CDN's only instruction. Give the CDN its own TTL in its cache policy and purge on deploy; see `assets-and-cdn.md`.

## The navigation request and why browsers reused it

Client-side navigation fetches `/<path>?_rsc=<hash>` with `RSC: 1` headers. The
hash comes from `computeCacheBustingSearchParam(prefetchHeader,
segmentPrefetchHeader, stateTreeHeader, nextUrlHeader)` in
`shared/lib/router/utils/cache-busting-search-param.js`, and the build id is not
part of it. The same navigation has the same URL across deploys, so a cached
response from the previous build matches a request made by the new one.

A hand-made `_rsc` value is redirected (307 to `?_rsc` without a value), so test
navigation responses from a real browser, not curl.

## Build id: deploymentId

- **Where it's read:** Next reads `NEXT_DEPLOYMENT_ID` from the environment at build time (`dist/server/config.js`) and sets `deploymentId`. Setting both the config and the env var to different values throws.
- **What it changes:**
  - Assets get `?dpl=<id>` (scripts, styles, chunks loaded later).
  - Responses carry `x-nextjs-deployment-id: <id>`.
  - Navigation requests send `x-deployment-id`.
  - The client compares the response's id (or the flight payload's `b`) with its own. On a mismatch, a navigation falls back to a full page load (`doMpaNavigation` in `router-reducer/fetch-server-response.js`).
  - In the prefetch path (`segment-cache/cache.js`), a mismatched prefetch is dropped and "treated as a 404". That is one way a stale navigation becomes a false 404, which the not-found reload below covers.
- **Which value:** the commit SHA, so every build of one commit (per architecture, per app) shares it. Without a SHA (a one-off local build), fall back to the build time, computed once in the shell that runs `next build`, never inside `next.config` (it may be evaluated more than once).
- **Runtime:** the standalone server uses the config baked at build, so the variable is only needed at build time.

Dockerfile (builder stage):

```dockerfile
ARG NEXT_DEPLOYMENT_ID=""
RUN NEXT_DEPLOYMENT_ID="${NEXT_DEPLOYMENT_ID:-build-$(date -u +%Y%m%d%H%M%S)}" \
    pnpm --filter @app/${APP} build
```

GitHub Actions (`docker/build-push-action`), once per app and architecture:

```yaml
build-args: |
  APP=web
  NEXT_DEPLOYMENT_ID=${{ github.sha }}
```

## The client caches that keep the app fast

- **Router cache (in memory, per tab).** Next's glossary: it "stores RSC Payload for visited and prefetched routes. During client-side navigation, Next.js serves cached layouts and loading states instantly without a server request. Pages are not cached by default but are reused during browser back/forward navigation." It is cleared on a full load, and HTTP headers don't affect it.
- **`experimental.staleTimes`:** `dynamic` defaults to 0 seconds; `static` (prerendered pages, or `prefetch={true}`) defaults to 5 minutes. It does not change back/forward reuse.
- **TanStack Query:** set `staleTime` and `gcTime` per query family (for example 1 minute and 15 minutes as defaults, 0 for money and payment state). Going back shows cached data at once and refetches behind it.

Turning off browser page caching costs one small request on a full page load;
none of the in-app speed above depends on it.

## Recovery helpers

One helper per app, local to the app: an error page runs exactly when code
loading is broken, so it should import as little as possible.

```ts
// src/lib/stale-build.ts
const CODE_LOAD_RELOAD = 'app:stale-build-reload';
const NOT_FOUND_RELOAD = 'app:not-found-reload';
const ONE_RELOAD_PER_MS = 60_000;

// `e.i(...)` is Turbopack's module lookup: an error naming it means a module came
// back without the export its caller was built against.
const CODE_LOAD_ERROR =
  /ChunkLoadError|Loading (CSS )?chunk|dynamically imported module|Importing a module script failed|module factory is not available|Class extends value|\b[\w$]\.i\(\.\.\.\)/i;

export function isCodeLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.name === 'ChunkLoadError' || CODE_LOAD_ERROR.test(error.message);
}

export function reloadPage(): void {
  window.location.reload();
}

function reloadOnce(key: string, reload: () => void): boolean {
  try {
    const last = Number(window.sessionStorage.getItem(key) ?? 0);
    if (Date.now() - last < ONE_RELOAD_PER_MS) return false;
    window.sessionStorage.setItem(key, String(Date.now()));
  } catch {
    return false;
  }
  reload();
  return true;
}

export function reloadOnceAfterCodeLoadError(error: unknown, reload = reloadPage): boolean {
  if (!isCodeLoadError(error)) return false;
  return reloadOnce(CODE_LOAD_RELOAD, reload);
}

export function arrivedByClientNavigation(): boolean {
  const [entry] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
  if (!entry) return false;
  try {
    return new URL(entry.name).pathname !== window.location.pathname;
  } catch {
    return false;
  }
}

export function reloadOnceIfNotFoundAfterNavigation(reload = reloadPage): boolean {
  if (!arrivedByClientNavigation()) return false;
  return reloadOnce(NOT_FOUND_RELOAD, reload);
}
```

Use in `app/error.tsx`, `app/global-error.tsx` and any nested `error.tsx`:

```tsx
export default function Error({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    if (reloadOnceAfterCodeLoadError(error)) return;
    console.error('[App Error]', error);
  }, [error]);
  // "Try again" calls reloadPage, never reset(): reset() re-renders with the
  // modules already loaded and cannot fix an error that came from loading them.
  // A "back to dashboard" button uses window.location.assign, not router.push.
}
```

Use in `app/not-found.tsx`: a client component calling
`reloadOnceIfNotFoundAfterNavigation()` in an effect. From a server component,
render a tiny client child that does it.

Unit tests:
- inject `reload`, since jsdom's `window.location` can't be spied on;
- jsdom has no `performance.getEntriesByType`, so define it with `Object.defineProperty(performance, 'getEntriesByType', { configurable: true, value: () => [{ name: url }] })`.

## Known quirks

- **Missing preload:** Turbopack's `react-loadable-manifest.json` can name a chunk the build never wrote, and the page then preloads it (`<link rel="preload" ... fetchPriority="low">`). It's a harmless 404; the module is in another chunk. Don't chase it as the cause of a crash.
- **The trace names the wrong module:** `Class extends value undefined` from TanStack Query means a `QueryObserver` from one build met a `Subscribable` export name from another. The same goes for `(0 , e.i(...).default) is not a function`. These are version-mix errors, not bugs in the module the trace names.
