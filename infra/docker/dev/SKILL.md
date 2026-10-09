---
name: docker-dev
description: Docker and Compose for local development that stays fast and does not fight the host. Covers the change loop (reloaders, restarting a process instead of rebuilding, Compose watch), bind mounts without root-owned files, where dependencies live, Compose structure (fixed project name, include, profiles, anchors, health-gated depends_on), env files, running commands inside containers, memory limits, disk cleanup, and the Linux traps (SELinux labels on Fedora, published ports that bypass the firewall, CRLF scripts, files replaced under a single-file mount, logs symlinked to stdout). Use when setting up or debugging a local Docker stack, or when a change does not show up in a running container.
---

# Docker for development

The goal locally: **a saved file shows up in seconds, and the stack never needs a full rebuild for a code change.** Start with the restart, recreate or rebuild table in [`../SKILL.md`](../SKILL.md); everything here builds on it.

## The change loop

- **Mount the source, keep the image for dependencies.** Bind-mount the code directory into the container; build the image only for the OS packages and dependencies. A code change then needs at most a process restart.
- **Use the framework's reloader where it is safe** (`runserver`, `next dev`, `uvicorn --reload`). Where the dev stack runs the production server (gunicorn under supervisord) to stay close to prod, restart the process, not the container: `docker compose exec api supervisorctl restart gunicorn`. Seconds instead of a rebuild.
- **Workers do not reload.** Celery and similar workers load code once. After a code change, `docker compose restart worker`.
- **Compose watch** (`develop.watch` in the compose file, run with `docker compose watch`) can sync files, restart, or rebuild per path: `sync` for source, `rebuild` for the lock file. Useful where bind mounts are slow (Docker Desktop on macOS and Windows).
- **Keep a production-image profile beside the dev one.** Put services that build the real Dockerfile under `profiles: [built]`, so a release build can be checked locally on demand without slowing the daily loop.

## Files and ownership

- **Root inside the container writes root-owned files on the host** through a bind mount (`__pycache__`, `.next`, uploads, migrations generated in the container). Run dev containers as your user: `user: "${UID:-1000}:${GID:-1000}"`. Export `UID` and `GID` in your shell profile, since `UID` is a read-only shell variable that is not exported by default.
- **Decide where dependencies live, once.**
  - In the image: reproducible, but a bind mount of the project hides them. Mask the path with an anonymous volume (`- /app/node_modules`).
  - On the host: the editor sees them and installs are fast, but they must be built for the container's OS and architecture (native modules break across macOS and Linux).
  Write the choice at the top of the compose file.
- **Mount directories, not single files,** when the file changes during development. Editors save by writing a new file and renaming it, which leaves a single-file mount pointing at the old one.
- **Named volumes for data, bind mounts for code.** Database data in a named volume survives `down`. `docker compose down -v` deletes it: never type it out of habit.

## Compose structure

- **Fix the project name** (`name: myapp` at the top). Container names, networks and volumes then stay the same whatever directory you run from, so scripts and `docker exec myapp-api-1` keep working.
- **One stack from several repos:** a root compose file with `include:` pulls each repo's compose file in with its own project directory.
- **Anchors for shared settings:** `x-app: &app` blocks merged with `<<: *app` keep restart policy, env files and networks in one place.
- **Gate start-up on health, not on start:** `depends_on: { db: { condition: service_healthy } }` with a real health check on the database. Plain `depends_on` only waits for the container to exist.
- **Health checks need their tool in the image.** Slim images often lack `curl`; use `wget`, a small script in the app's language, or install `curl` explicitly.
- **Restart policy `unless-stopped`** so the stack comes back after a reboot but stays down when you stop it.

## Environment

- **Two different `.env` files, easy to confuse.** The `.env` beside the compose file is read by Compose to fill `${VARS}` in the compose file. `env_file:` passes variables into the container. A value in one is not in the other.
- **Environment is read at container creation.** Change it, then recreate (`up -d`), not restart.
- **Local secrets stay in git-ignored files** and out of the build context (`.dockerignore` them), or a local build bakes them into an image you might later push.

## Running things inside containers

- `docker compose exec api python manage.py migrate`, not a new container per command (`run` creates a new container each time; add `--rm` if you use it).
- **Variables expand on the host unless quoted for the container:** `docker exec api sh -c 'echo $DATABASE_URL'` reads the container's value; `docker exec api echo $DATABASE_URL` reads yours.
- **Read logs with `docker logs` or `docker compose logs -f svc`.** Images that link their log files to `/dev/stdout` (nginx does) hang a `grep` or `tail` on that file forever.

## Resources and disk

- **Set memory limits on hungry services** (`mem_limit`, or `deploy.resources.limits.memory`). A search engine or a JVM left at defaults can starve the rest of the machine. Size the heap below the limit (`-Xmx`), and for Node `--max-old-space-size`.
- **Stop what you do not use.** A local search cluster costs gigabytes while the app can run without it.
- **The build cache and old images grow without bound.** `docker system df` shows it; `docker builder prune --keep-storage 20GB` and `docker image prune` reclaim it. Prune volumes only by name.

## Linux traps

- **SELinux (Fedora, RHEL):** bind mounts fail with "permission denied" until labelled. Add `:z` (shared) or `:Z` (private to one container) to the mount. Never put `:Z` on your home directory or another broad path: it relabels everything under it for that container alone.
- **Published ports bypass the host firewall.** Docker writes its own iptables rules, so `ports: "5432:5432"` exposes the database to the whole network even with firewalld or ufw blocking 5432. Bind dev ports to loopback: `"127.0.0.1:5432:5432"`.
- **`network_mode: host` works only on Linux.** It is handy when browser and server must both reach `localhost`, but it is not portable to Docker Desktop.
- **CRLF line endings break shell scripts** copied from Windows (`/bin/sh^M: bad interpreter`). Add `*.sh text eol=lf` to `.gitattributes`, and check scripts sent over `scp`.
- **Rootless Docker or Podman** maps your user to root inside the container, which removes the ownership problem but changes UIDs inside; know which one the machine runs.

## Checklist for a new local stack

1. Project name fixed; one command brings everything up.
2. Code bind-mounted; dependencies' location decided and written down.
3. Containers run as the host user; no root-owned files appear in the repo.
4. Databases on named volumes, ports bound to `127.0.0.1`.
5. Health checks on every service others depend on, and `condition: service_healthy`.
6. A `built` profile that runs the production Dockerfile.
7. The restart, recreate or rebuild table pinned in the README.
