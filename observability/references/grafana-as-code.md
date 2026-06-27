# Grafana as code

Datasources, dashboards, and alert rules live in files that Grafana reads on boot
from `/etc/grafana/provisioning`. The box is reproducible and the config is
reviewable in git. Mount the directory read-only so the files stay authoritative.

```
grafana/provisioning/
  datasources/datasources.yaml
  dashboards/dashboards.yaml
  dashboards/<one json per dashboard>
  alerting/alert-rules.yaml
  alerting/contact-points.yaml
  alerting/notification-policies.yaml
```

## Datasources

Give each datasource a stable hand-set `uid` so dashboard JSON can reference it
across rebuilds. Use `access: proxy` (Grafana fetches server-side, the browser
never hits the datasource) and `editable: false` (the file is the source of truth,
the UI cannot drift from it).

```yaml
# datasources/datasources.yaml
apiVersion: 1
datasources:
  - name: Prometheus
    type: prometheus
    uid: prometheus
    access: proxy
    url: http://prometheus:9090        # Docker service name, same host
    isDefault: true
    editable: false
    jsonData:
      timeInterval: "15s"              # match the Prometheus scrape interval
      httpMethod: POST

  - name: Loki
    type: loki
    uid: loki
    access: proxy
    url: http://loki:3100
    editable: false
    jsonData: { maxLines: 5000, timeout: 60 }

  - name: CloudWatch
    type: cloudwatch
    uid: cloudwatch
    access: proxy
    editable: false
    jsonData:
      authType: ec2_iam_role           # the instance profile, no static keys
      defaultRegion: us-east-1
```

Two things to notice. The URLs are Docker service names because Grafana shares the
host network with Prometheus and Loki; the internal DNS names are only for
cross-host callers. CloudWatch carries no credentials: it authenticates with the
instance role, which requires `GF_AWS_ALLOWED_AUTH_PROVIDERS` to include
`ec2_iam_role` and the box's role to have CloudWatch read permissions.

If you want logs to link to traces, add a `derivedFields` block on the Loki
datasource that extracts a trace id from the log body and links to a tracing
datasource. The source system did not run tracing (RUM and errors are stored as
logs and issues, not spans), so there was no Tempo datasource and no logs-to-traces
link. Add Tempo and the derived field if you adopt tracing.

## Dashboards

A provider tells Grafana where to load dashboard JSON and how often to re-read it.

```yaml
# dashboards/dashboards.yaml
apiVersion: 1
providers:
  - name: App Dashboards
    orgId: 1
    type: file
    updateIntervalSeconds: 30          # re-read the directory every 30s
    allowUiUpdates: true               # UI edits write back to the JSON file
    options:
      path: /etc/grafana/provisioning/dashboards
      foldersFromFilesStructure: true  # subdirectories become Grafana folders
```

Set each dashboard JSON's `uid` to match the datasource it queries, so panels bind
correctly after a rebuild. A practical four-dashboard split:

- Backend (queries Prometheus): request rate, response status distribution, latency
  percentiles, 5xx error rate, DB query rate and latency, plus a health row (up,
  uptime, 24h availability, current p95, current 5xx). All from the
  `django_http_*` and DB metrics.
- Frontend RUM (queries Loki with LogQL over `{kind="faro"}`): active sessions, JS
  errors, page views, Core Web Vitals (LCP, CLS, INP), error rate per minute,
  recent errors table. RUM is logs here, not a metrics store, so the panels are
  LogQL, not PromQL.
- Observability infrastructure (queries Prometheus, node-exporter and cAdvisor):
  the monitoring box's own CPU, memory, disk, network, and per-container resource
  use. The stack watching itself.
- Cloud infrastructure (queries CloudWatch): managed services the app depends on,
  the load balancer, the database, the cache, the container platform.

Author dashboards in the UI, then export the JSON into the provisioning directory,
or hand-write them. With `allowUiUpdates: true`, UI edits persist to the file, so
commit the result.

## Alerting

Three files: the rules, the contact points, the routing. Grafana's unified
alerting evaluates a rule as a small query graph. A common shape is two nodes: refId
`A` is a Prometheus instant query, refId `C` is a `classic_conditions` threshold
against the expression engine (`datasourceUid: __expr__`).

```yaml
# alerting/alert-rules.yaml
apiVersion: 1
groups:
  - orgId: 1
    name: App
    folder: App Alerts
    interval: 1m
    rules:
      - title: API Down
        condition: C
        for: 1m
        labels: { severity: critical }
        noDataState: Alerting           # no data means the API is gone, page it
        execErrState: Alerting
        data:
          - refId: A
            datasourceUid: prometheus
            model: { expr: 'up{job="app"}', instant: true }
          - refId: C
            datasourceUid: __expr__
            model:
              type: classic_conditions
              conditions: [{ evaluator: { type: lt, params: [1] }, query: { params: [A] } }]

      - title: High 5xx Error Rate
        condition: C
        for: 2m
        labels: { severity: warning }
        data:
          - refId: A
            datasourceUid: prometheus
            model:
              instant: true
              expr: >
                (sum(rate(django_http_responses_total_by_status_total{job="app",status=~"5.."}[5m])) or vector(0))
                / (sum(rate(django_http_responses_total_by_status_total{job="app"}[5m])) > 0)
          - refId: C
            datasourceUid: __expr__
            model:
              type: classic_conditions
              conditions: [{ evaluator: { type: gt, params: [0.05] }, query: { params: [A] } }]

      - title: High p95 Latency
        condition: C
        for: 5m
        labels: { severity: warning }
        data:
          - refId: A
            datasourceUid: prometheus
            model:
              instant: true
              expr: >
                histogram_quantile(0.95,
                  sum(rate(django_http_requests_latency_including_middlewares_seconds_bucket{job="app"}[5m])) by (le))
          - refId: C
            datasourceUid: __expr__
            model:
              type: classic_conditions
              conditions: [{ evaluator: { type: gt, params: [2] }, query: { params: [A] } }]
```

```yaml
# alerting/contact-points.yaml
apiVersion: 1
contactPoints:
  - orgId: 1
    name: Email
    receivers:
      - uid: email-primary
        type: email
        settings: { addresses: alerts@example.com }
```

```yaml
# alerting/notification-policies.yaml
apiVersion: 1
policies:
  - orgId: 1
    receiver: Email
    group_by: ["alertname", "job"]
    group_wait: 30s
    group_interval: 5m
    repeat_interval: 4h
```

The SMTP transport itself is not in these files; it is the `GF_SMTP_*` env on the
Grafana container. The single catch-all policy sends every severity to one place;
add sub-routes keyed on the `severity` label if you want critical to page and
warning to email.

Two gotchas the source system carried. First, the rules query `job="app"`, but the
scrape job name and the file-discovery `job` label can differ, and if they do the
rule matches nothing and never fires. Confirm the series your rule queries actually
exists in Prometheus. Second, alert message templates hardcoded `http://localhost`
links to Grafana and the error backend, which are only correct through a port-forward
tunnel and read wrong over a mesh VPN where the real names are
`grafana.internal.example:3001`. Use the real internal names (or the public Grafana
URL if you have one) in the templates.
