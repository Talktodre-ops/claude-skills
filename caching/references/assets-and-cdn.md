# Asset archive and CDN

Old clients must always be able to fetch their own build's files, and new
servers must never be asked for files they do not have. Containers can't
promise either: each holds only its own build.

## Why a container is not enough

- **A tab opened yesterday** asks for yesterday's chunks; no container has them anymore.
- **A rolling deploy** starts the new task before stopping the old one (ECS 100/200). For about a minute both answer behind the load balancer. A page from one task asks the other for a chunk it lacks: 404. In the running example this was the known "new routes 404 for a minute during the swap".

## The archive pattern

Every deploy adds its fingerprinted files to shared storage and deletes nothing.
Traffic for `/_next/static/*` (or your framework's asset path) is served from
that storage, never from an app container.

### On AWS: S3 behind CloudFront

1. **Bucket:** a private bucket, read only through CloudFront origin access control (OAC; legacy OAI is not supported on flat-rate plans).
2. **Behaviour:** a CloudFront behaviour for `/_next/static/*` with the S3 origin.
   - Use the managed CachingOptimized policy; it leaves query strings out of the cache key, so `?dpl=` doesn't split the cache.
   - Everything else goes to the load balancer.
3. **Upload in CI before the service update,** so no page names a file that isn't there yet.
   - Copy the asset folder out of the built image (`docker create`, then `docker cp <id>:/app/apps/web/.next/static`).
   - Upload with `aws s3 cp --recursive --cache-control "public, max-age=31536000, immutable"`.
   - Never `aws s3 sync --delete`.
4. **Retention:** a lifecycle rule expiring objects after 30 days. **Trap:** S3 counts age from the object's last write. If CI uploads only changed files, a chunk that never changes, still used by the live build, ages out and disappears. Re-upload every file on every deploy so live files stay young.
5. **One architecture:** upload from the architecture production runs. Separate per-architecture builds should write identical names; prove it once before uploading from more than one.
6. **Admin and other internal apps** can stay on the load balancer; their few users recover with the client reload nets.

### On a single box: a folder behind nginx

```nginx
# Every deploy copies its .next/static into /srv/static-archive/_next/static
# (cp -r, no delete). Old and new builds' files sit side by side.
location /_next/static/ {
    root /srv/static-archive;
    try_files $uri @app;
    add_header Cache-Control "public, max-age=31536000, immutable" always;
}
location @app {
    proxy_pass http://web:3000;
}
```

A scheduled `find /srv/static-archive -type f -mtime +30 -delete` bounds it, on the
same re-copy rule as the lifecycle trap above.

## Pages at the CDN

At small scale, don't cache pages at the CDN at all: cache policy CachingDisabled
for the default behaviour, `/api/*` and websocket paths. The browser rule
(`no-store`) plus the server render cache are enough.

At scale, cache public pages at the edge for a short window:

- **Separate the edge window from the browser header.** The browser must still never store pages; the edge may for seconds to minutes.
  - On CloudFront, the edge TTL comes from the cache policy (min, default, max TTL) together with the origin's `Cache-Control`. A response headers policy can change what is sent on to the viewer.
  - Verify before relying on it how CloudFront treats an origin `no-store` or `private` with a non-zero minimum TTL, and whether a response headers policy can override `Cache-Control` for viewers.
  - Other CDNs read `CDN-Cache-Control` or `Surrogate-Control` for the edge and pass `Cache-Control` to the browser.
- **Never cache signed-in pages at the edge.** Exclude by path, or by the presence of the session cookie in the cache key policy. A wrong edge rule shows one person's page to another.
- **Invalidate page paths on every deploy, never the asset paths.** On CloudFront the first 1,000 invalidation paths a month are free (as of November 2026; verify).

## Version routing during rollouts (at scale)

- Deploy blue/green, and keep the old version up for a grace period (about 15 minutes) instead of stopping it.
- Route by the build id the client sends. Next sends `x-deployment-id` on navigation requests, so an ALB listener rule on that header can send an old tab's requests to the old target group until it reloads.
- Then version mixing during rollouts doesn't happen at all, rather than being caught and reloaded.

## Cost

Price from measured traffic, never from memory: requests and bytes out over 30
days (load balancer `RequestCount` and `ProcessedBytes`, the latter an upper bound
because it counts both directions), asset size per build, and deploys a month.
Then read the CDN's current free tier, regional rates and flat-rate plans
(load the `grounded-research` skill).

Example, November 2026: 3.26 M requests and at most 128 GB a month fitted inside CloudFront's permanent free tier of 1 TB and 10 M requests. The 30-day S3 archive (12 builds of 8.6 MB) cost under $0.05. Re-price before acting; these figures date.
