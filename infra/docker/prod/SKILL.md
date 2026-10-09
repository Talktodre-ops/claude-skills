---
name: docker-prod
description: Production Docker images and runtime, learned on Django, Celery and Next.js images running on ECS on EC2 across amd64 and Graviton arm64. Covers small multi-stage images, non-root users, BuildKit caches and build secrets, the build context, immutable sha tags, multi-arch manifests, build-time versus run-time configuration (Next.js public variables), PID 1 and graceful shutdown, health checks and start periods, read-only filesystems and dropped capabilities, migrations as a one-off task, memory limits, and image scanning. Use when writing or reviewing a production Dockerfile, a CI image build, or a container's runtime settings.
---

# Docker for production

The goal in production: **a small image that runs as a non-root user, holds no secrets, is identified by an immutable tag, starts fast, reports its health honestly and stops cleanly.** The shared rules are in [`../SKILL.md`](../SKILL.md).

## Building the image

- **Multi-stage, always.** A build stage with compilers and dev dependencies; a runtime stage that copies only what runs. `build-essential`, headers and package caches stay in the build stage. Python: build wheels in the builder, install them in the runtime. Node: Next.js `output: "standalone"` copies a self-contained server and no `node_modules`.
- **Slim or distroless runtime bases,** pinned to an exact version. Add the digest (`python:3.12-slim@sha256:...`) where reproducibility matters, and rebuild on a schedule anyway so OS patches arrive.
- **Layer order:** OS packages, manifests, dependency install, source. `apt-get update` and `install` in the same `RUN`, ending with `rm -rf /var/lib/apt/lists/*`.
- **BuildKit cache mounts speed up installs** (`RUN --mount=type=cache,target=/root/.cache/pip pip install ...`). Do not also pass `--no-cache-dir`: then pip writes nothing to the cache and the mount does nothing.
- **Set ownership as you copy.** `COPY --chown=app:app . .` costs nothing. A later `RUN chown -R app:app /app` writes a second copy of every file into a new layer and doubles the image.
- **Build secrets** (a private registry token) use `RUN --mount=type=secret,id=npm_token`, never `ARG`.
- **The build context** is whatever `.dockerignore` lets through: exclude `.git`, `.env*`, tests, docs, local data and caches. CI builds from a clean checkout, but local builds do not, and a local image pushed by mistake carries what was in the folder.

## Users and permissions

- **End the Dockerfile with `USER app`** (a fixed UID such as 1001 helps volume permissions match).
- **If a process manager must start as root** (supervisord, an entrypoint that fixes permissions), drop to the app user for the actual processes (`user=app` per supervisord program, or `exec gosu app "$@"`). A root `[supervisord]` with no `user=` on its programs runs the app as root.
- **Runtime hardening where the platform allows:** read-only root filesystem with a writable `tmpfs` for `/tmp`; drop all Linux capabilities and add back only what is needed; `no-new-privileges`. Ports above 1024 need no capabilities.

## Tags and architecture

- **Deploy by immutable tag:** `sha-<commit>`. `latest` is a pointer that moves; a worker restarted between deploys on `latest` can pull a different build from the API it runs beside.
- **Multi-arch manifests** let the same tag run on x86 and ARM hosts. Build each architecture on a native runner (QEMU emulation is many times slower), push by digest, then join them into one manifest with `docker buildx imagetools create`. Moving hosts between architectures then needs no rebuild.
- **Check third-party images exist for every architecture you run** before switching hosts.
- **Architecture-specific paths** (`/usr/lib/x86_64-linux-gnu` versus `aarch64-linux-gnu`) break settings that hard-code them. Resolve them in the Dockerfile into one stable path (a symlink) so configuration does not care.

## Configuration: build time versus run time

- **Most configuration belongs at run time** (environment variables injected by the platform), so one image serves every environment.
- **Some frameworks inline variables at build time.** Next.js replaces `NEXT_PUBLIC_*` in the client bundle and in statically rendered pages during `next build`; a value set only at run time is missing from every prerendered page. Pass those as build args, and accept that the image is then per environment.
- **Build args are not secret.** They appear in `docker history`. Only public values go there.

## Process, signals and shutdown

- **Exec-form `CMD`/`ENTRYPOINT`,** and an entrypoint script that ends with `exec "$@"`, so the app is PID 1 or a direct child that receives SIGTERM.
- **PID 1 does not reap zombies or get default signal handling.** Use `--init` / `init: true` (tini), or a process manager that does both.
- **Graceful shutdown must fit the platform's stop timeout.** gunicorn finishes in-flight requests within its graceful timeout; a Celery worker finishes running tasks on a warm shutdown. Set the container stop timeout longer than both, or work is killed mid-flight.
- **One concern per container where you can.** A process manager running several programs in one container hides a dead program behind a live container; if you use one, make the health check cover the program that matters.

## Health and readiness

- **The health check tests the app, not the process:** an HTTP endpoint that touches what the app needs to serve.
- **Give slow starters a start period** (`startPeriod`, or `health_check_grace_period_seconds` on the load balancer side), or the orchestrator kills them while they warm up.
- **Keep the check cheap and local.** A health check that calls a third-party API turns their outage into yours.

## Data and state

- **The container filesystem is disposable.** Uploads go to object storage, sessions to a cache or database, logs to stdout.
- **Migrations run once per deploy, as a one-off task, before the new code serves traffic.** Not in the entrypoint: with several replicas they race, and a failed migration restarts the container in a loop.

## Resources

- **Set memory reservation and a hard limit** per container, measured from real usage plus headroom.
- **Make runtimes respect the limit:** JVM heap below the container limit (`-Xmx`), Node `--max-old-space-size`, gunicorn workers times threads within memory and the database's connection limit.
- **Size for packing, not just for running.** On shared hosts, the deploy strategy needs free room for a replacement copy, or tasks must be replaced in place.

## Supply chain

- **Scan images in CI** (Trivy, Docker Scout or Grype) and fail on critical findings; keep a visible backlog for the rest.
- **Audit dependencies at the version actually installed,** transitive packages included.
- **Remove what you do not use.** A library pulled in only for one feature (GDAL format drivers, for example) can have its unused parts disabled so their advisories are unreachable; write down why.

## Production Dockerfile checklist

1. Multi-stage; runtime stage has no compilers or package caches.
2. Base pinned; rebuilt on a schedule.
3. `.dockerignore` excludes `.git`, `.env*`, tests and data.
4. `COPY --chown`, final `USER` non-root, process manager programs non-root.
5. No secrets in `ARG`, `ENV`, layers or context.
6. Exec-form command; signals reach the app; stop timeout covers graceful shutdown.
7. Health check with a start period.
8. Immutable sha tag; multi-arch manifest if hosts vary.
9. Migrations as a one-off task, not in the entrypoint.
10. Scanned in CI.
