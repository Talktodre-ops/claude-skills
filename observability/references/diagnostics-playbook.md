# Diagnostics playbook: the toolkit and how it makes an app faster and better

Field notes from wiring this stack into a live FastAPI + Celery + React app on
Docker. The blueprint (SKILL.md) is the architecture. This is the practical part:
which tool answers which question, the setup that actually worked, and the sharp
edges that cost time so you skip them next time. The toolkit is stack-agnostic;
the recipes port to any similar app.

## The toolkit: which tool answers which question

| Question | Tool | How |
|---|---|---|
| Request rate, 5xx, latency p50/95/99 by route, in-flight | Prometheus + `prometheus-fastapi-instrumentator` | `Instrumentator(should_group_status_codes=False).instrument(app, metric_namespace="app").expose(app, endpoint="/metrics")` as the outermost layer |
| Backend process memory / CPU (no cadvisor needed) | `prometheus_client` default collectors | free on the same `/metrics`: `process_resident_memory_bytes`, `process_cpu_seconds_total` |
| Queries per request by route (N+1), slow queries | SQLAlchemy `before/after_cursor_execute` hooks | a histogram of query count per request + a `possible_n_plus_1` warning over a threshold |
| Structured logs, error filtering, request tracing | Loki + Grafana Alloy | JSON logs to stdout, Alloy tails the Docker socket, `level` promoted to an index label, `request_id` as structured metadata |
| Host + container CPU/memory | node-exporter + cadvisor | read the host directly; no app change |
| Backend exceptions with stack traces + grouping | GlitchTip + `sentry-sdk[fastapi]` | `sentry_sdk.init(dsn=..., environment=...)` before app creation; auto-instruments FastAPI, SQLAlchemy, Redis, Celery |
| Frontend errors, page loads, Core Web Vitals | Grafana Faro + Alloy `faro.receiver` | `@grafana/faro-web-sdk` `initializeFaro({url, app, instrumentations: getWebInstrumentations()})` streams to Alloy -> Loki |
| Celery throughput / failures / queue depth | `danihodovic/celery-exporter` | reads the Redis broker + the task events the worker already emits (`worker_send_task_events=True`) |
| Redis memory / ops / clients / keyspace | `oliver006/redis_exporter` | `REDIS_ADDR=redis://redis:6379` |
| Alert on 5xx / memory / target down / queue backlog | Grafana unified alerting + SMTP | provisioned rules (instant query -> threshold) + an email contact point |

## The join key: request_id (the single most useful primitive)

Set a correlation id in one outermost middleware, echo it in the `X-Request-ID`
response header, and inject it into every log line via a `ContextVar` + a
`logging.Filter`. Carry the same id into the error tracker. Now one id ties a
request across the access log, any inner log (auth, audit), the error's stack
trace, and what the client saw. This is what turns three disconnected tools into
one story. Build it first; everything else leans on it.

## Diagnostic recipes: turning a symptom into a fix

- **"This endpoint feels slow."** Open the N+1 board (queries-per-request p95 by
  route). The tallest route is firing one query per row. Confirm with
  `{service="backend"} | json | event="possible_n_plus_1"` (route + count), then
  fix with eager-loading / a join / an index. This is how you find the O(n) query
  fan-out that a latency number alone never explains.
- **"Is memory leaking?"** cadvisor per-container on a Linux host (or
  `process_resident_memory_bytes` locally). A steady climb that a restart resets
  is a leak.
- **"A 500 happened."** GlitchTip has the stack trace; Loki
  `{service="backend", level="ERROR"}` has the context; the `request_id` on both
  (and in the response header the user can quote) stitches it together.
- **"The frontend feels janky / users see errors."** Faro Core Web Vitals
  (LCP/FCP/TTFB p75) and JS error rate by page, all in Grafana, no third-party.
- **"Workers are behind."** Celery `queue_length` rising + `failures by task`
  naming the culprit, whose trace is in GlitchTip.

## Gotchas that cost time (skip them)

- **cadvisor on Docker Desktop / WSL2** cannot read the split overlay2 data root,
  so it drops per-container series (`failed to identify the read-write layer ID`).
  It works on a native-Linux host. Do not rabbit-hole a local fix; use
  `process_resident_memory_bytes` for per-service memory locally.
- **Faro receiver silently drops everything** if it tries to download sourcemaps
  from app URLs unreachable from inside the container (the failed fetch fails the
  whole log export). Set `sourcemaps { download = false }`.
- **Faro's logfmt uses `app_name`, not `app`.** Route the `faro.receiver` output
  through `loki.process` with `stage.logfmt { mapping = { "kind"="", "app"="app_name" } }`
  then `stage.labels` to get `{app=..., kind=exception|measurement|event}`.
- **GlitchTip project keys are UUIDs.** The Python `sentry-sdk` accepts them, but
  `@sentry/react` rejects them as an "Invalid Sentry Dsn". So GlitchTip works for
  the backend; use Faro (not Sentry-JS) for the frontend.
- **The per-request query counter must be a mutable object in a `ContextVar`**
  (e.g. a one-element list you mutate), not a plain int you reassign. It has to
  survive both SQLAlchemy's async-to-greenlet hop and Starlette's
  `BaseHTTPMiddleware` context copy; a reassigned int reads back as zero.
- **A managed Postgres pooler (PgBouncer transaction mode, e.g. Neon)** resets
  connection-level settings, so `statement_timeout` must be set as a ROLE default,
  not per-connection.
- **Grafana refuses to boot with an invalid SMTP `from_address`.** Use a
  valid-format placeholder (`x@example.com`), not a bare token, or it crash-loops.
- **Verify metrics by querying, not by eyeballing a dashboard.** Query the
  Prometheus/Loki HTTP API (or Grafana's datasource proxy). Metric queries return
  clean numbers; for Loki prefer `count_over_time(...)` over reading log lines.
  Two shell traps on Windows/MSYS: a query with `/1024` gets mangled into a path
  (`export MSYS_NO_PATHCONV=1`), and an unencoded `{label="value"}` with quotes
  silently returns empty (use `--data-urlencode` or an anchored regex).
- **Alert rules:** instant query -> threshold expression, `noDataState: OK` so
  they stay quiet until something is actually wrong. Provision the contact point
  and policy alongside the rules.

## Reusing this elsewhere

Nothing here is Meritlab-specific. The Prometheus instrumentator + SQLAlchemy-hook
N+1 detector ports to any Python/SQLAlchemy service. Faro ports to any SPA. Alloy
+ Loki + cadvisor + node-exporter port to any Docker host. The celery/redis
exporters and GlitchTip work with any Celery/Sentry-SDK app. The one idea to carry
into every project regardless of stack is the `request_id` join key.
