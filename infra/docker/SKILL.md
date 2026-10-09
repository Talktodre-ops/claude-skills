---
name: docker
description: Best practices for building and running Docker containers, for local development and for production, learned on a Django, Celery, Next.js and nginx stack running in Compose locally and on ECS in production. Covers images that run as a non-root user, small multi-stage builds, layer order and BuildKit caches, secrets that never reach an image, signals and PID 1, health checks, and the restart-versus-recreate-versus-rebuild decision that saves most of a developer's waiting. Splits into a dev skill (fast loops, bind mounts, file ownership, Compose patterns, SELinux, the firewall Docker bypasses) and a prod skill (hardening, immutable tags, multi-arch, graceful shutdown, config at build time versus run time). Use when writing a Dockerfile or compose file, reviewing one, debugging a container that does not pick up a change, or preparing an image for production.
---

# Docker, done well

Containers are easy to start and easy to get subtly wrong. Most pain comes from a handful of misunderstandings: what a restart actually reloads, who owns the files, what ends up inside the image, and what happens to signals. This skill fixes those first.

- [`dev/SKILL.md`](dev/SKILL.md): local development. Fast change loops, bind mounts without root-owned files, Compose patterns, and the Linux traps.
- [`prod/SKILL.md`](prod/SKILL.md): production images and runtime. Hardening, tags, multi-arch, shutdown, config, scanning.
- [`../SKILL.md`](../SKILL.md): the AWS and Terraform side, for where these images run.

## The rules that apply everywhere

1. **Run as a non-root user.** Create a user in the image and end with `USER app`. Copy files in owned by it (`COPY --chown=app:app`). A process manager that must start as root (supervisord) still runs each program with `user=app`.
2. **Order layers by how often they change.** System packages, then the dependency manifest, then the dependency install, then the source. A code change then rebuilds one layer, not the dependency install.
3. **Keep the build context small and clean.** A `.dockerignore` that excludes `.git`, `.env*`, `node_modules`, caches, test output and local data. Without it, `COPY . .` copies your local secrets into the image.
4. **Never put a secret in an image.** Not in `COPY`, not in `ARG` or `ENV` (both show in `docker history`). Build-time secrets use `RUN --mount=type=secret`. Runtime secrets arrive as environment variables or files at start.
5. **Use the exec form for the main process.** `CMD ["gunicorn", ...]`, not `CMD gunicorn ...`. The shell form makes `/bin/sh` PID 1, which does not forward SIGTERM: every stop waits the full timeout and then kills.
6. **Log to stdout and stderr.** The platform collects them. Nothing inside the container should depend on a log file.
7. **Give every long-running service a health check** that uses a tool present in the image.
8. **Pin what you build on.** Base images by exact tag (and digest in production), dependencies by lock file.

## Restart, recreate or rebuild

The decision that wastes the most time when it is wrong. A **restart** keeps the same container: same image, same environment, same mounts. A **recreate** makes a new container from the same image and re-reads the compose file and env files. A **rebuild** makes a new image.

| What changed | Do this | Why |
|---|---|---|
| Source file, bind-mounted, app has a reloader | Nothing | The reloader picks it up |
| Source file, bind-mounted, no reloader (gunicorn, Celery) | Restart the process: `docker compose exec api supervisorctl restart gunicorn`, or `docker compose restart api` | Seconds, no rebuild |
| Source file, copied into the image (not mounted) | Rebuild that service | The container has its own copy |
| A value in `.env` or `env_file` | `docker compose up -d <svc>` (recreate) | **`restart` does not re-read environment**; the old values stay |
| `compose.yaml` (ports, volumes, command, env) | `docker compose up -d <svc>` | Compose recreates only what changed |
| A single-file bind mount, edited by a tool that replaces the file (most editors, `sed -i`, `git checkout`) | `docker compose up -d --force-recreate <svc>`, or mount the directory instead | The mount points at the old inode; the container never sees the new file |
| Dependency manifest or lock file | Rebuild, then recreate: `docker compose build <svc> && docker compose up -d <svc>` | Dependencies live in the image |
| Dockerfile | Rebuild | |
| A container that others reach by name was recreated (the app behind nginx) | Restart the proxy too | nginx resolves upstream names once at start and keeps the old IP; it shows as 502, often reported as a CORS error |

When several services share one image (API, worker, scheduler), rebuild all of them after a dependency change. Rebuilding only the API leaves the worker on the old image, crash-looping on an import it does not have.

## Non-negotiables

- Non-root at runtime.
- No secrets in the image, its history or the build context.
- Exec-form entrypoint, signals reach the app.
- Logs on stdout and stderr.
- Know whether a change needs a restart, a recreate or a rebuild before you wait for one.
