---
name: observability-stack
description: Blueprint for a self-hosted, open-source observability stack and how to wire an app into it. Prometheus for metrics, Loki (with an S3 object store) for logs, Grafana as the single query pane, Grafana Alloy for log collection and Faro browser RUM, and GlitchTip (Sentry-API-compatible) for error tracking, on one Docker Compose host, provisioned as code (datasources, dashboards, alerts). App integration covers FireLens dual-write logs, Prometheus scraping with ECS service discovery, Faro RUM through a same-origin proxy, and the Sentry SDK to GlitchTip, with a shared low-cardinality label taxonomy and a request id as the cross-tool join key. Use when standing up observability, instrumenting a service, or adapting the stack to another deployment.
---

# Observability stack blueprint

A complete, self-hosted observability system built from open-source tools, plus
the patterns to feed a real application into it. Distilled from a production
Django and ECS deployment. The configs are real (Prometheus scrape, Loki schema,
Alloy pipeline, Grafana provisioning, Fluent Bit, django-prometheus, Sentry SDK),
not pseudocode.

This file is the map. The four reference files hold the implementation:

- `references/stack-and-compose.md`: the components, version pinning, the Docker
  Compose wiring, and each tool's config (Prometheus, Loki on S3, Grafana, Alloy).
- `references/instrumentation.md`: how application telemetry gets in. Logs,
  metrics, browser RUM, and errors, with the label taxonomy that keeps Loki cheap.
- `references/grafana-as-code.md`: datasources, dashboards, and alerting all
  provisioned from files, so the box is reproducible.
- `references/deploy-and-access.md`: the single-host deploy, secrets and IAM,
  retention, the private-network access model, the gotchas, and how to adapt it.

Read a reference when you reach that layer. Lift the pattern, rename to the target
project, and pin the versions before you ship.

## The four signals and where they land

Treat observability as four separate data types, each with its own store, joined
in one query pane:

1. Metrics: numeric time series (request rate, latency percentiles, error rate,
   resource use). Stored in Prometheus, pulled from a `/metrics` endpoint.
2. Logs: structured event lines. Stored in Loki, pushed by a collector. Cheap to
   keep if you label them carefully.
3. Real user monitoring (RUM): what the browser actually experienced (Core Web
   Vitals, navigations, JS errors). Collected by Grafana Faro, stored in Loki as
   logs, queried with LogQL.
4. Errors: exceptions with stack traces, grouped into issues. Stored in GlitchTip,
   which speaks the Sentry API, so the standard Sentry SDK works unchanged.

Grafana is the single pane over metrics (Prometheus), logs and RUM (Loki), and any
cloud metrics (CloudWatch via the instance role). Errors live in GlitchTip's own
UI and are the drill-down target from an alert.

## How the tools connect

Metrics are pulled. Prometheus scrapes itself, the collector, host and container
exporters (node-exporter, cAdvisor), and the application's `/metrics` endpoint.
For containers with rotating IPs (ECS, autoscaling), a small script regenerates a
Prometheus file service-discovery target list on a timer.

Logs and RUM are pushed. A collector (Grafana Alloy locally, Fluent Bit via
FireLens on ECS) reads container stdout and pushes to Loki's push API. The browser
RUM SDK posts to a same-origin proxy that forwards to the Alloy Faro receiver,
which writes the events into Loki as logs.

Errors are pushed. The app's Sentry SDK sends exceptions to GlitchTip's
Sentry-compatible ingest endpoint.

Everything runs on one Docker network so services reach each other by name
(`prometheus:9090`, `loki:3100`). Cross-host callers (the app's log sidecars, the
browser proxy) use internal DNS names instead.

## Core design decisions (and the tradeoffs)

One pane, separate stores. Do not try to put logs in your metrics system or
metrics in your log system. Each store is good at one shape of data. Grafana joins
them at query time. The cost is running several services; the payoff is that each
one stays cheap and fast at its job.

Low-cardinality labels, rich body. This is the rule that keeps Loki affordable.
Label a log stream only by a small, stable set (environment, tier, role, job).
Never label by request id, user id, or anything unbounded, because Loki creates a
stream per unique label set and high cardinality is what blows it up. Put the rich,
high-cardinality fields in the log body as JSON and query them with LogQL filters.
The same taxonomy (env, tier, role, job) recurs across the log labels, the
collector relabel rules, and the RUM labels, so dashboards and alerts are portable.

A request id joins the tools. Stamp one id per request, put it in the structured
log line and in the error event (via the Sentry `before_send` hook). Now an error
in GlitchTip links to the exact log lines in Loki, and an alert links to both. This
is the cheapest thing you can do that makes incidents tractable.

Logs dual-write during a cutover. When you migrate from a cloud log service to
Loki, keep writing both for a while: Loki as the new primary, the cloud service as
a fallback. Existing dashboards and alerts keep working, and a brief Loki outage
does not lose logs. There is a sharp edge here (see the next point).

Provision everything as code. Datasources, dashboards, and alert rules live in
files that the stack reads on boot. The box is reproducible and the config is
reviewable in git. The tradeoff is config delivery: if the box pulls config at boot
only, a change needs a redeploy or a manual pull, so wire in an update path.

Auth cloud datasources with the instance role. If the box runs in a cloud, let
Grafana and Loki use the instance role (or workload identity) for cloud APIs.
No static keys in any config file.

## Build order

1. Stand up the stack with Docker Compose: Prometheus, Loki, Grafana, the
   collector (Alloy), and the error backend (GlitchTip with its own Postgres and
   Redis). Pin every image to a real version, not `latest`.
2. Point Loki at object storage (S3 or compatible) so logs survive the box, and
   set retention with the compactor.
3. Provision Grafana from files: the three datasources, the dashboards, the alert
   rules and contact points.
4. Instrument the app: a metrics endpoint, structured JSON logs with the label
   taxonomy, the RUM SDK behind a same-origin proxy, and the error SDK.
5. Wire collection: the log sidecar or Alloy docker tail to Loki, Prometheus
   service discovery to the app's `/metrics`, the Faro receiver, the error DSN.
6. Deploy the box on a private network, deliver secrets through a secret store and
   cloud access through the instance role, and reach it over an SSM tunnel or a
   mesh VPN, never a public port.

## Non-negotiables

- Pin image versions. An observability stack on `latest` is not reproducible and
  will drift under you.
- Keep log labels low-cardinality. One unbounded label can take down Loki.
- Carry a request id from logs into errors so the tools cross-link.
- Loki on object storage, with retention enforced by the compactor.
- No static cloud keys in config. Use the instance role.
- The box is private. Reach it through a tunnel or mesh, not a public IP.
- If you dual-write logs, the collector's outputs share one buffer: a failing or
  unreachable output back-pressures the input and drops the other output's logs
  too. Make every output reachable, or remove it before it goes dark.
