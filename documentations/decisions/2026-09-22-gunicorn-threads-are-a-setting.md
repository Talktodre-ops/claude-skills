# Gunicorn worker threads are a setting, defaulting to what production already runs

Date: 2026-09-22. Status: accepted. Source: noticing the running container and
the repository disagreed about the worker class.

## Decision

`GUNICORN_THREADS` is the single knob. `supervisord.conf` reads it, the
Dockerfile defaults it to 1 and docker compose sets 8 for local development.
`--worker-class` is gone from the command line.

## Why one knob

Gunicorn resolves the worker class from the thread count on its own: sync at 1,
gthread above it, confirmed in the installed source rather than assumed. Keeping
only `--threads` means the class and the count cannot be set to disagree.

## What was actually wrong

Local gunicorn had been running gthread with 8 threads, and only because
someone edited `/etc/supervisor/supervisord.conf` inside the running container.
That file is baked into the image. The repository copy is bind mounted a
directory away at `/usr/local/app/supervisord.conf`, which supervisord never
reads, so the edit lived in the container's writable layer and the next
`docker compose up` would have taken it quietly back to sync.

Two files with the same name, one of them read and one of them not, is the
whole failure. The live process and the file in the repository described
different servers and nothing surfaced it.

## Why the default is 1 and not 8

1 is the sync worker this has always run, so any environment that does not set
the variable stays exactly where it is and this can be carried forward without
being a production change. Verified on a real build: no override logs
`Using worker: sync`, `GUNICORN_THREADS=8` logs `Using worker: gthread`, four
workers either way.

Threads are worth having where the database is a network hop away and requests
spend their time waiting rather than computing, which is local against Neon.
They are not free. Django holds a connection per thread and `CONN_MAX_AGE` is
600, so the ceiling becomes workers times threads: 32 rather than 4 at these
numbers. That is a local pooler's problem to absorb, not something to inflict
on a production database by default.

## Consequences

The mqtt client's design note described the topology as four sync workers and
now says four forked workers that may each run several threads. The design it
argues for is unaffected, because each publish already opens its own connection
rather than sharing a client across the fork.

Anything else that assumes one request per process is now worth a second look
wherever threads are raised. Module level mutable state is the usual casualty.
