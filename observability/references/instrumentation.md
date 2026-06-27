# Instrumenting the app

Four paths get telemetry into the stack: logs, metrics, browser RUM, and errors.
Backend code is Django; the patterns carry to any stack. The unifying ideas are
the label taxonomy (env, tier, role, job) and one request id stamped into both
logs and errors.

## The label taxonomy

Every log stream and RUM event carries the same small label set:

- `env`: production, staging, local.
- `tier`: backend, frontend, infra.
- `role`: the specific component (api, celery, frontend).
- `job`: the scrape or stream job name.

Nothing else goes in a label. Request ids, user ids, paths, and status codes live
in the log body as JSON fields and are filtered with LogQL at query time. This is
the difference between a Loki bill you can afford and one you cannot, because Loki
creates one stream per unique label set. Use the same taxonomy in Prometheus
relabeling so a panel written against `tier="backend"` works across both stores.

## 1. Logs

Log structured JSON from the app, one object per line, with a stable set of fields
including the request id. Then a collector ships stdout to Loki.

On plain Docker, Grafana Alloy tails the Docker socket (see `stack-and-compose.md`).

On ECS, use a Fluent Bit sidecar via FireLens, and dual-write to Loki and the cloud
log service during a cutover. The app container opts in with the `awsfirelens` log
driver and passes per-task Loki options; FireLens turns those into a Fluent Bit
output at launch.

```hcl
# the app container's log config (Terraform)
logConfiguration = {
  logDriver = "awsfirelens"
  options = {
    Name        = "loki"
    Host        = "loki.internal.example"
    port        = "3100"
    labels      = "env=${var.env},tier=backend,role=api,job=api"
    line_format = "json"
  }
}
dependsOn = [{ containerName = "log_router", condition = "START" }]
```

The Fluent Bit sidecar reads an "extra" config (hosted in S3 so a change is a
deploy, not an image rebuild) that adds the cloud-log output as a global match:

```ini
[SERVICE]
    Flush       5
    Grace       30
    Log_Level   warn
[OUTPUT]
    Name              cloudwatch_logs
    Match             *                       # FireLens auto-tags each container by name
    region            ${AWS_REGION}
    log_group_name    ${CW_LOG_GROUP}
    log_stream_prefix ${CW_STREAM_PREFIX}/
    auto_create_group false
    retry_limit       2
```

The back-pressure gotcha, which is the sharp edge of dual-write. The two outputs
(Loki and CloudWatch) share one input buffer (default 25 MB). If either output
cannot drain, because it lacks IAM permission, or because the Loki host is
unreachable, the buffer fills, the input back-pressures, and records destined for
the other output are dropped too. The symptom is Loki going silent on your
chattiest service within minutes, even though Loki is fine. Two consequences:

- Fluent Bit's AWS calls use the task role, not the execution role. Grant the task
  role `logs:CreateLogStream`, `logs:PutLogEvents`, and `logs:DescribeLogStreams`,
  scoped to the two log groups, or CloudWatch fails closed and takes Loki with it.
- Before you decommission Loki, flip the app to cloud-log-only first. If the Loki
  host disappears while the output still points at it, the same back-pressure drops
  your application logs. Make the Loki output a toggle.

## 2. Metrics

Expose `/metrics` from the app process and let Prometheus pull it. With Django,
django-prometheus does it:

```python
# settings.py
INSTALLED_APPS = [..., "django_prometheus"]
MIDDLEWARE = [
    "django_prometheus.middleware.PrometheusBeforeMiddleware",   # outermost
    ...                                                          # your middleware
    "django_prometheus.middleware.PrometheusAfterMiddleware",    # innermost
]
DATABASES = {"default": {"ENGINE": "django_prometheus.db.backends.postgresql", ...}}
```

```python
# urls.py
urlpatterns = [..., path("", include("django_prometheus.urls"))]   # serves /metrics
```

The before and after middleware bracket the whole stack so every other
middleware's time is measured. `/metrics` is served by the same process on the same
port; no separate metrics port. Do not expose it publicly: at the load balancer,
route only your real paths (`/api*`, `/health*`) to the app, so `/metrics` is
reachable only from inside the network by the monitoring box.

Discovering rotating targets. Container IPs change on every deploy, so a small
script regenerates a Prometheus file service-discovery list on a timer. It lists
the running tasks, reads their private IPs, and writes the target file:

```bash
#!/usr/bin/env bash
# runs every 30s via a systemd timer on the monitoring box
TASK_ARNS=$(aws ecs list-tasks --cluster "$CLUSTER" --service-name "$SERVICE" \
  --desired-status RUNNING --query "taskArns" --output text)
IPS=$(aws ecs describe-tasks --cluster "$CLUSTER" --tasks $TASK_ARNS \
  --query "tasks[*].attachments[0].details[?name=='privateIPv4Address'].value" --output text)
TARGETS=$(echo "$IPS" | sed 's/.*/"&:8000"/' | paste -sd ',' -)
printf '[{"targets":[%s],"labels":{"job":"app","env":"production"}}]\n' "$TARGETS" \
  > /opt/monitoring/prometheus/targets/app.json
```

This needs `ecs:ListTasks` and `ecs:DescribeTasks` on the monitoring box's role, and
a security group rule that lets the monitoring box reach the app's metrics port
(8000 here), opened only when the monitoring stack exists. Note this script targets
one service; add the others if you want their metrics too. And make sure the `job`
label the script injects matches what your alert rules query (see the Prometheus
note in `stack-and-compose.md`).

## 3. Browser RUM (Grafana Faro)

Faro is a browser SDK that captures Core Web Vitals, navigations, and JS errors and
posts them to the Alloy Faro receiver, which writes them into Loki as logs. Init it
once, lazily, and route through a same-origin proxy so there is no CORS or
mixed-content problem and the internal collector stays private.

```ts
// lib/faro.ts
let faro: Faro | undefined;
export function initFaro() {
  if (faro || typeof window === "undefined") return;
  const envUrl = process.env.NEXT_PUBLIC_FARO_COLLECTOR_URL;
  if (envUrl === "") return;                          // explicit empty string disables it
  const url = envUrl || "/faro/collect";              // same-origin path, not /api/...
  import("@grafana/faro-web-sdk").then(({ initializeFaro, getWebInstrumentations }) => {
    faro = initializeFaro({
      url,
      app: { name: "myapp-web", version: process.env.NEXT_PUBLIC_VERSION, environment: "production" },
      instrumentations: getWebInstrumentations({ captureConsole: true }),
      batching: { itemLimit: 50, sendTimeout: 250 },
    });
  });
}
```

The same-origin proxy forwards to the internal Alloy host and swallows failures so a
telemetry hiccup never reaches the user:

```ts
// app/faro/collect/route.ts (Next.js route handler)
const ALLOY = process.env.ALLOY_FARO_URL ?? "http://alloy.internal.example:12347/collect";
export async function POST(req: Request) {
  try { await fetch(ALLOY, { method: "POST", body: await req.arrayBuffer() }); } catch {}
  return new Response(null, { status: 204 });
}
```

The path is `/faro/collect`, deliberately not under `/api`, because the load
balancer routes `/api*` to the backend, not the frontend. The dynamic import keeps
the SDK out of the server bundle. The empty-string disable switch stops a flood of
failed beacons in local dev where no collector runs. The receiver's CORS wildcard is
safe because the only real caller is your own server-side proxy.

## 4. Errors (Sentry SDK to GlitchTip)

GlitchTip speaks the Sentry API, so the stock Sentry SDK works; only the DSN points
at GlitchTip. The init is gated on the DSN being set, so an empty DSN disables it
entirely.

```python
# settings.py
SENTRY_DSN = os.getenv("SENTRY_DSN", "").strip()
if SENTRY_DSN:
    import sentry_sdk
    from sentry_sdk.integrations.django import DjangoIntegration
    from sentry_sdk.integrations.celery import CeleryIntegration
    from sentry_sdk.integrations.logging import LoggingIntegration

    def _before_send(event, hint):
        rid = get_request_id()                  # same id stamped on the JSON log line
        if rid:
            event.setdefault("tags", {})["request_id"] = rid
        return event

    sentry_sdk.init(
        dsn=SENTRY_DSN,                          # http://<key>@glitchtip.internal.example:8090/<project>
        integrations=[
            DjangoIntegration(transaction_style="url"),   # group by URL pattern, not per path
            CeleryIntegration(monitor_beat_tasks=True),   # beat cron health
            LoggingIntegration(level="INFO", event_level="ERROR"),  # INFO breadcrumbs, ERROR events
        ],
        environment=os.getenv("ENVIRONMENT", "production"),
        release=os.getenv("GIT_SHA", "unknown"),
        traces_sample_rate=float(os.getenv("SENTRY_TRACES_SAMPLE_RATE", "0.1")),    # 10% perf traces
        profiles_sample_rate=float(os.getenv("SENTRY_PROFILES_SAMPLE_RATE", "0.0")),
        send_default_pii=False,                  # no emails, IPs, cookies leave the app
        before_send=_before_send,
        max_breadcrumbs=50,
    )
```

The `before_send` hook is the join: the same request id that tags the log line tags
the error event, so an issue in GlitchTip pivots straight to the matching Loki log
lines. `transaction_style="url"` groups by route pattern to avoid cardinality
blow-up. `send_default_pii=False` is the privacy default; turn it on only
deliberately. The frontend gets its own error SDK (Sentry for Next.js) pointed at
the same GlitchTip, which is separate from the Faro RUM path: RUM goes to Loki,
errors go to GlitchTip.

## Where each signal lands (summary)

- Logs: Loki (collector), plus the cloud log service during a cutover.
- Metrics: Prometheus (pull from `/metrics`). Cloud infra metrics come from
  CloudWatch via the Grafana datasource.
- RUM: Loki, written by the Alloy Faro receiver, queried as logs with LogQL.
- Errors: GlitchTip, via the Sentry SDK.
