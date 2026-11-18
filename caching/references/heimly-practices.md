# Heimly: the caching practices as built

A worked example for the `caching` skill. Everything here was read from the
Heimly code in November 2026. Paths are relative to the monorepo root
(`BE-heimly/`, `FE-heimly/`, `Infra-Heimly/`). Re-check the values after a
change; TTLs move.

The stack: Django REST with Celery and Redis (Valkey on AWS) on the server;
Next.js 16 App Router with TanStack Query in `FE-heimly/apps/web`; MQTT (EMQX)
for real-time pushes; no CDN today. The HTTP and deploy layer is covered in
`nextjs.md`, `assets-and-cdn.md` and `verification.md`. This file covers the
rest of the map from section 1 of `SKILL.md`: the server data cache, the server
render cache and the client data cache, and how real-time messages touch them.

## 1. Server data cache (Django, Redis)

### Configuration

`BE-heimly/core/settings.py` (`CACHES`) defines two aliases on one Redis, each
on its own database number (a third, `search`, was removed unused in BE #294):

| Alias | Redis db | `KEY_PREFIX` | Default TTL | Used for |
|---|---|---|---|---|
| `default` | 0 | `heimly` | 3600 s | Almost everything. zlib compression, pool of 50 connections |
| `hot` | 1 | `heimly:hot` | 900 s | Favourite sets only (`property/favourites_cache.py`), cleared after commit by signals on `Favourite` |

`CACHE_TTL` in the same file holds named TTLs; `STATIC_DATA` is 86400 s and is
used by the property type and electricity band lookups.

### Key naming

Keys are plain strings built by hand: `<area>:<thing>:<id or hash>`. Real keys:

| Key | TTL | What it holds |
|---|---|---|
| `heimly:auth:user:{id}` | 60 s | The signed-in user row (`account/services/auth_cache.py`) |
| `feature_flags:all` | 300 s | Every flag and its allowlists (`account/services/feature_flags.py`) |
| `help_topics:active` | 300 s | Active help topics (`help_topics/views.py`) |
| `marketplace:detail:{uuid}` and `...:full` | 60 s | Public property detail, without and with the street address |
| `marketplace:anon:{name}:{sha1}` | 30 s | Signed-out marketplace list, featured strip, search |
| `reference:{name}:{sha1}` | 600 s | Amenities, countries, states, local governments, areas |
| `notif_unread_count:{user}` | 30 s | Bell badge count |
| `favorites:{user}:{org}` (in `hot`) | 900 s | A user's favourited property uuids per organization |
| `understand:v9:{sha256}` | 24 h | Sentence search parse result |
| `understand:catalog:v6` | 1 h | Search vocabulary catalog |
| `listing_assistant:vocab:v2` | 1 h | Listing assistant vocabulary |
| `listing_assistant:description:v2:{sha256}` | 24 h | AI listing check, write and title answers |
| `listing_market:price_range:v1:{sha256}` | 6 h | Price range per area, type and bedrooms |
| `marketplace:totals:v1:{amount}` | 300 s | Services marketplace totals |
| `where:v1:{lat}:{lng}` | 7 days | Reverse geocode at about 100 m (`search/where.py`) |

Rules visible in the keys:
- Big or free-form inputs (a search text, a query string, a facts dict) are hashed (sha1 or sha256), never put in the key raw.
- The host and scheme are part of the hash for list answers, because pagination links carry them (`property/services/marketplace_cache.py`, `core/reference_cache.py`).
- Org-scoped data carries the org in the key (`favorites:{user}:{org}`). The active org comes only from `X-Organization-ID`.
- Counters and locks use `cache.add` (set if absent) and `cache.incr`: rate and attempt limits, `last_seen`, invite renewal, AI daily budget (`core/ai.py`). These are not data caches.

### Versioned keys: bump when the answer shape changes

Some keys carry a version in the name: `understand:v9:`, `understand:catalog:v6`,
`listing_assistant:vocab:v2`, `listing_assistant:description:v2:`,
`listing_market:price_range:v1:`, `marketplace:totals:v1:`, `where:v1:`.
The code says it in a comment (`search/understand/service.py`): "Bump when the
answer's shape changes, or cached answers keep the old one." After a deploy
that changes the shape, an old key would be served to new code for up to its TTL
(24 h for `understand`). Changing the name makes the old keys unreachable; they
age out.

### Public answers kept under a moving version

`BE-heimly/base/public_cache.py` is the pattern for public answers that many
writes can change (find agents, the services marketplace):
- A small version key `pubv:{space}:{name}` holds a random token with no TTL.
- Every cached key is `pub:{space}:{name}:{version}:{hash of parts}`.
- A write calls `public_cache.bump(name)`. That sets a new token, so every answer of that name is retired at once. Old keys age out.
- `bump` sets the token now and again in `transaction.on_commit`, so a read between the write and the commit cannot re-cache the old answer.
- `remember(name, parts, ttl, build)` reads or builds. If Redis is down it builds every time. `PUBLIC_CACHE_ENABLED=0` turns it off.
- `{space}` is a hash of the database host and name, so two databases on one Redis never read each other's answers.
- Nothing viewer-specific may be cached here. Viewer fields are merged after the read.
- `cache_control()` sends `public, max-age=N, stale-while-revalidate=5N` to signed-out viewers and `private, no-cache` to signed-in ones, with `Vary: Cookie, Authorization, X-Organization-ID`.

Users of it: `property/views/directory.py` (list 60 s, profile 120 s; retired by
`retire_cached_find_agents` in `property/signals.py` on any directory profile
save or delete) and `marketplace/services/cache.py` (search 60 s, profile 120 s,
categories 3600 s; retired by post_save and post_delete on the profile,
credential and category models).

### Invalidation on write

| Cache | How it is cleared |
|---|---|
| Feature flags | `post_save`, `post_delete` and `m2m_changed` on the flag model call `cache.delete(FLAG_CACHE_KEY)` (`account/models/feature_flag.py`). `FeatureFlagService.invalidate_cache()` does the same. The 300 s TTL is only a safety net |
| Help topics | Signal handler `_drop_cache` in `help_topics/models.py` |
| Signed-in user | `post_save` and `post_delete` drop `heimly:auth:user:{id}` (`auth_cache.py`). The 60 s TTL covers bulk updates a signal cannot see. It caches identity only; permission flags are checked on the live row. `HEIMLY_AUTH_CACHE=0` turns it off without a deploy |
| Property detail | `_invalidate_marketplace_detail_cache(uuid)` in `property/views/property.py` deletes both forms after an update, when a property goes back to draft, and when its status changes (three call sites). The 60 s TTL covers the rest |
| Bell count | `invalidate_unread_count(user)` on mark-as-read, in `property/models/notification.py` and `chat/tasks.py` |
| Signed-out marketplace answers | No invalidation. They live `MARKETPLACE_ANON_CACHE_SECONDS` (30 s) and the settings comment says changes show "up to this long" later |
| Reference lookups | No invalidation. `REFERENCE_CACHE_SECONDS` (600 s), plus `public, max-age=3600` to the browser |
| Public answers | `public_cache.bump` as above |

The rule behind the table: if a signal or a write path can clear it, clear it.
If it cannot (bulk update, raw SQL, a row on another app), keep the TTL short
and write the staleness down next to the setting.

Every cache read and write in these helpers is wrapped in try/except and falls
back to the database. A Redis outage must slow the app, never break it.

### Tests share the live Redis

`.agents/tools/runtests.sh` overrides only the database. Pytest inside the API
container reads the same Redis as the running stack, so a flag or a list cached
by someone clicking around leaks into a test. What we do:
- Fixtures that seed flags call `FeatureFlagService.invalidate_cache()` after seeding and after deleting.
- Several test packages (`rent_ops/tests/conftest.py`, `payments/tests/conftest.py`, `tests/test_address_*.py`) replace every alias in `settings.CACHES` with a local-memory cache.
- `public_cache` namespaces its keys by database host and name for the same reason.

Still open: a per-run cache prefix in `runtests.sh`.

## 2. Index and cache freshness after a write: use on_commit

A write inside `transaction.atomic()` is not visible to another connection until
the block commits. Work that reads the row from elsewhere (a Celery task, a
search index, a cache refill) will see the old row or none. The rule we hold:
anything that hands a row to another process runs in `transaction.on_commit`.

Where it shows up in the code today:
- `base/deferred.py`: `later("module.function", **ids)` wraps the Celery hand-off in `transaction.on_commit`. Notices, emails and the blog refresh use it.
- `base/public_cache.py`: `bump` sets the version now and again on commit (above).
- `blog/signals.py`: any blog change calls `later("blog.services.live.refresh_web")`.

History: the Elasticsearch indexing signal processor enqueued its task inside
the transaction, the worker did not find the row, and the row was never indexed.
The fix was `on_commit`, plus a one-off backfill, because the fix only helps new
writes. Note: the repo no longer contains that signal processor or an
Elasticsearch client (see open questions), but the rule stands for any
replacement.

## 3. Next.js server render cache

Pages in `FE-heimly/apps/web/src/app` keep a server-side copy for a number of
seconds. Values in the code:

| Where | Setting | Seconds |
|---|---|---|
| `app/page.tsx`, `app/blog/page.tsx`, `app/blog/[slug]/page.tsx`, `app/pricing/page.tsx` | `export const revalidate` | 60 |
| `app/help/page.tsx`, `app/help/[key]/page.tsx` | `export const revalidate` | 300 |
| `app/services/[slug]/page.tsx` | `fetch` with `next: { revalidate }` | 60 |
| `app/find-properties/[id]/page.tsx`, `.../[slug]/page.tsx`, `app/find-agents/[slug]/page.tsx` | `fetch` with `next: { revalidate }` | 300 |
| `app/find-properties/state/[state]/page.tsx`, `components/seo/RelatedListings.tsx`, the OG image and share card routes | `fetch` with `next: { revalidate }` | 600 |
| `app/sitemap.ts`, `lib/locations.ts` | `fetch` with `next: { revalidate }` | 3600 |

The data fetches are public, so they can be shared. Signed-in data is never
fetched this way; it goes through the client cache in section 4.

### On-demand refresh

`app/cache-refresh/route.ts` (POST) lets the API drop cached pages without
waiting for the timer:
- The caller sends `X-Revalidate-Secret`. The route compares it with `REVALIDATE_SECRET` using `timingSafeEqual` and answers 401 on a mismatch.
- The body names an `area`. Only `blog` is defined. It calls `revalidateTag('blog', { expire: 0 })` and `revalidatePath` for `/blog` (layout), `/` and `/sitemap.xml`.
- `lib/blog-api.ts` tags its fetches `blog`, so the tag reaches them.
- The API side is `BE-heimly/blog/services/live.py` (`refresh_web`): a 5 s timeout, returns False and logs on any failure, does nothing when `WEB_REVALIDATE_URL` or `WEB_REVALIDATE_SECRET` is empty. The URL defaults to `{FRONTEND_URL}/cache-refresh`.
- It runs from `blog/signals.py` through `later(...)`, so only after the blog write commits.
- A failed call is harmless by design: the pages rebuild on their own within the 60 s timer.
- The secret reaches the web container as `REVALIDATE_SECRET` from SSM (`Infra-Heimly/infra/modules/ecs-services/main.tf`).

Only the blog is wired. Every other public page waits for its timer.

## 4. Client data cache (TanStack Query)

### Defaults

`FE-heimly/apps/web/src/provider/QueryProvider.tsx`:

```ts
queries: {
  retry: 2,
  staleTime: 60 * 1000,        // 1 min default; individual hooks override this
  gcTime: 15 * 60 * 1000,
  refetchOnWindowFocus: false, // prevents surprise network calls on tab switch
}
```

The client is created in `useState`, so each browser tab has its own and a full
load always starts empty.

### Key factories

`apps/web/src/lib/query-keys.ts` has factories for the domains that were
getting out of step; older code still uses literal arrays.

| Factory | Shape | Note |
|---|---|---|
| `propertyKeys` | `['property', id]` root; `detail` and `marketplace` extend it | One prefix call clears every view of a property |
| `paymentKeys` | `['payments', orgId, ...]` | Org in the key |
| `marketplaceKeys` | `['marketplace', ...]`, org-scoped for jobs and profile | |
| `dealKeys` | `['deals', orgId, 'conversation', groupUuid]` | |

Org-scoped keys carry the org id so switching organization never shows another
org's rows.

### staleTime by domain

Chosen by how wrong the screen is allowed to be, not by habit.

| Domain | Setting | Why |
|---|---|---|
| Payments (`hooks/usePayments.ts`) | `staleTime: 0`, `refetchOnWindowFocus: true`; the detail polls every 5 s while the state is `AWAITING_PAYMENT` | Money state must never look settled when it is not |
| Deals (`hooks/useDeal.ts`) | `staleTime: 0`, refetch on focus | Same reason; writes patch the cache directly |
| Chat thread (`components/chat/ChatPage.tsx`) | `staleTime: Infinity` | MQTT keeps it current; a refetch would race the pushes |
| Chat list | `staleTime` 10 s, `refetchInterval` 15 s, refetch on focus | Patched in place by MQTT too; the poll is the safety net |
| Feature flags (`hooks/useFlag.ts`) | 15 min | Matches the `/me` revalidation cadence; server side the flags cache clears on save |
| Lookups (`property-wizard/useLookups.ts`) | one day, some one hour | Reference data |
| Dashboard property lists | 1 to 10 min | Lists are invalidated by the edit flow |
| Rent Ops edit dialogs, import plan, support centre, application list | `staleTime: 0` | Forms and queues must read fresh |

Prefetching on link hover (`components/PrefetchLink.tsx`) uses 1 to 10 min
depending on the page, so the click lands on warm data.

### Updating after a write

Three tools, used for different jobs:

| Tool | Use it when | Example |
|---|---|---|
| `invalidateQueries` | The server computes the new state and a refetch is fine | Property lists after an edit; `['notifications']` after a bell push |
| `removeQueries` | A cached copy must not be shown at all on the next visit | Property edit (below) |
| `setQueryData` / `setQueriesData` | The answer or push already holds the new state, and a refetch could race it | Chat threads, the chat list, deals (`lib/deal-cache.ts`) |

Pattern for mutations: pass `{ onSuccess, onError }` to `.mutate()` per call.
For a list that changes page or filter, `placeholderData: (previous) => previous`
or `keepPreviousData` keeps rows on screen while the next page loads
(`hooks/useMarketplace.ts`, `hooks/useRentOps.ts`, directory and sales lists).
The payments list is the careful case: it keeps the previous rows only when tab,
state, property, kind and `for` are unchanged, so a new filter shows a spinner,
never the old rows.

### The property detail lesson

Property detail used to live under three unrelated keys (`['property', id]`,
`['properties','detail',id]`, `['marketplace','property',id]`), and the edit
page invalidated only one. Removed photos then showed on the detail page for the
rest of the 2 minute `staleTime`. What we did:
- Put the views under one subtree with `propertyKeys` (`['property', id, 'detail']`, `['property', id, 'marketplace']`).
- The edit page calls `removeQueries({ queryKey: propertyKeys.one(propertyId) })` (`app/dashboard/landlord/properties/[id]/edit/page.tsx`). Remove, not invalidate, so a view mounted later cannot show the old copy.
- It also invalidates the landlord and agent list keys, which refetch on mount.

Loose ends: `components/rent-ops/quick-edit-dialog.tsx` still removes the literal
keys `['properties','detail',uuid]` and `['marketplace','property',uuid]`, which
are not under the new root (see open questions).

## 5. Real-time and the cache

MQTT is a nudge or a seed, never the record. The record is the API.
`FE-heimly/apps/web/src/contexts/MQTTContext.tsx` subscribes once per signed-in
user and routes each payload:

| Topic or event | What the client does |
|---|---|
| `user/{uuid}/messages` (new message) | `seedThreadMessage` writes the message into the thread cache, patches the chat list in place (preview, unread count), and does not invalidate |
| `chat/{groupId}` for the open conversation | A `deal_updated` payload on this topic goes to `applyDealUpdated`; messages arrive through the user topic |
| `deal_updated`, job updated, property availability | `lib/deal-cache.ts` and siblings patch the cache in place; a deal payload older than the cached one (by `updated_at`) is ignored |
| Notification | `invalidateQueries(['notifications'])`; reward notices also invalidate `['referrals']` and `['subscription']` |
| Favourite, saved search, maintenance | `invalidateQueries` on the matching prefix |

How the thread seed works (`lib/chat-thread-seed.ts`): it de-duplicates by id,
uuid or `temp_id` (so the sender's optimistic copy and the echo merge). If the
thread was never loaded it adds the message marked `_seeded` and marks the query
stale with `refetchType: 'none'`, so opening the conversation fetches the full
history once without a flash.

Rules that came out of the bugs:
- Never invalidate a chat thread or the chat list from the broker path. A refetch races the push and brings back an older state, such as an unread badge that had just been cleared.
- Per-user topics use the user uuid, never the integer id. A mismatch delivers to nobody and fails silently.
- Publish after the write commits, outside the atomic block.
- Measure real-time by comparing when the message arrives with when it paints, not by reading the code.

## 6. The HTTP layer, as built

Summary only. Details and code are in `nextjs.md`, `assets-and-cdn.md` and
`verification.md`.

- `FE-heimly/apps/web/next.config.ts` `headers()`: every path except `/_next/static` and `/_next/image` gets `private, no-cache, no-store, max-age=0, must-revalidate`. It replaces Next's own `s-maxage` plus a year of `stale-while-revalidate` on prerendered pages. The server render cache (section 3) is unaffected.
- `/_next/static` stays immutable and fingerprinted.
- `NEXT_DEPLOYMENT_ID` is a Docker build arg set to `github.sha` in CI (`.github/workflows/deploy.yml`) and a timestamp as the fallback (`Dockerfile`), so every asset URL and response carries the build.
- `apps/web/src/lib/stale-build.ts` holds the recovery reloads: one guarded reload (60 s, per tab, in `sessionStorage`) for code-load errors, and one reload for a "not found" reached by a client-side navigation. "Try again" on error pages is a full reload.
- The API sets its own rules: signed-out public answers `public, max-age=N, stale-while-revalidate=5N` (find agents), reference lookups `public, max-age=3600`, signed-in answers `private, no-cache` or `private, no-store`.

## 7. Rules we hold

1. Every cache has a named owner and a way out. If a write path can clear it, it does; if not, the TTL is short and the gap is written next to the setting. Reason: a cache nobody can empty becomes a bug report.
2. A change to a user, a flag or a permission must never wait for a cache. Signals drop the entry now; the TTL is a net for paths signals cannot see. Reason: stale permissions are a security bug.
3. Cache identity, not permission to act. Permission flags are read from the live row on each request. Reason: the user cache lives for 60 s.
4. Bump the key name when the cached shape changes (`understand:v9`). Reason: a deploy otherwise serves old shapes to new code for the whole TTL.
5. Public shared answers hold nothing viewer-specific; viewer fields are merged after the cached read, and signed-in requests bypass the shared copy. Reason: one viewer's address or plan must never reach another.
6. A street address is cached in its own `:full` key and sent `private, no-store`. Reason: the address rule decides who may see it.
7. Retire public answers by bumping a version, now and again on commit. Reason: a read between the write and the commit can re-cache the old answer.
8. Hand rows to other processes in `transaction.on_commit`. Reason: the worker cannot see an uncommitted row, and the work is skipped without an error.
9. Every Redis call is allowed to fail and falls back to the database. Reason: the cache saves work; it is not a dependency.
10. Money, deals and anything awaiting a third party read with `staleTime: 0` and refetch on focus. Reason: showing a settled state that is not settled costs trust.
11. Real-time pushes seed or patch the cache and never trigger a refetch of the same thing. Reason: the refetch races the push and brings back older data.
12. After an edit, remove the whole subtree of cached views of that record, not one key. Reason: a missed key keeps showing deleted media until a hard reload.
13. Key factories, not literals, for any record shown through more than one view. Reason: three literal keys for one property caused the edit bug.
14. Org id goes in the key for org-scoped data. Reason: switching organization must not show the last one's rows.
15. Tests that touch cached data invalidate or isolate the cache first. Reason: the local test run shares the live Redis.
16. Pages and navigation data are `no-store` to the browser; the server render cache does the saving. Reason: see `SKILL.md` section 2.

## Open questions and what was fixed

- Resolved 18 Nov 2026 (BE #294): the unused `search` cache alias is removed.
- Resolved 18 Nov 2026 (BE #294): `post_save`/`post_delete` on `Favourite` clear the person's cached list after commit (`property/favourites_cache.py`), and the toggle decides from the table. An organization deleted with `SET_NULL` moves rows by a bulk update that sends no signal; the 15 minute TTL covers that case.
- Signed-out marketplace answers and reference lookups have no invalidation. A property unpublished by a moderator can still show to signed-out viewers for up to 30 s on the list; the detail cache is cleared by the view paths listed, not by every status change path. Check the admin and Celery paths.
- Resolved 18 Nov 2026 (BE #294): the prints are gone, and the property-type key is a sha256 of the sorted query parameters. It used Python's `hash()`, which differs per process, so each worker kept its own copies.
- `blog` is the only area `cache-refresh` knows. Pricing, help and the landing page wait for their 60 or 300 s timers.
- Resolved 18 Nov 2026 (FE #277): the two dead literal keys are gone; `propertyKeys.one(uuid)` already removes every property query.
- Answered: OpenSearch was removed on 8 Oct 2026 (BE #190). Search reads Postgres directly (`base/search.py`, DRF SearchFilter, `base/text_search.py`), so a listing is searchable the moment its row commits; there is no index to keep fresh. The caches in front of search are the sentence parse (`understand:v9:`, results not cached), the 30 s signed-out marketplace answers under the `public_cache` token, and the 24 h property-type list.
- The `no-store` rule and the build id are on `origin/pre-prod` (FE #273 to #275); feature branches cut earlier pick them up on their next merge from pre-prod.
- `.env.local` is git-ignored, so the local `REVALIDATE_SECRET` never leaves the machine; production reads its own from SSM.
