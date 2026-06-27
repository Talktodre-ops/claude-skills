# Deploy, access, and adapt

The whole stack runs on one private virtual machine with Docker Compose. This is
the right size for a small-to-medium system: simple, cheap, and the failure modes
are understood. It is not highly available, which is a deliberate tradeoff covered
below.

## The box

One VM in a private subnet, no public IP, reaching the internet for image pulls
through a NAT gateway. A `t3.medium` (2 vCPU, 4 GB) carries the full stack
(Prometheus, Loki, Grafana, Alloy, GlitchTip and its Postgres and Redis) for a
modest workload. An encrypted root volume of about 40 GB holds the Prometheus TSDB
and any local Loki chunks. Provision it with Terraform behind an on/off flag so the
whole stack is a single toggle:

```hcl
module "monitoring" {
  count  = var.enable_monitoring ? 1 : 0
  source = "../../modules/monitoring"
  # ...
}
```

## Boot sequence (cloud-init / user_data)

The VM bootstraps itself. The steps, in order:

1. Install Docker and the Compose v2 plugin, enable Docker.
2. Write the stack's `.env` from a secret-store parameter
   (`get-parameter --with-decryption > /opt/observability/.env`).
3. Pull the config. The source system git-cloned a private config repo using a
   token from the secret store. S3 sync or a config baked into a custom image also
   work. Pick one and wire an update path (see the drift gotcha).
4. Create the shared Docker network, then `docker compose up -d`.
5. Run the error backend's one-shot migration.
6. Install the metrics target-discovery script and a systemd timer that re-runs it
   every 30 seconds.

Config delivery is the main operational gotcha. If the box pulls config only at
boot, a dashboard or alert change does not reach the running box until it is
replaced or someone manually pulls and restarts. Decide deliberately: replace the
instance on every config change (clean, slower), run a small timer that pulls and
reloads (live, more moving parts), or use hosted Grafana where dashboards are
managed by API. Do not leave it ambiguous, or the box drifts from the repo.

## Secrets and cloud access

Two rules keep credentials out of the codebase:

- The stack's `.env` is a single encrypted secret-store parameter, seeded once by
  Terraform and then left alone (`ignore_changes = [value]`) so the box owns its
  runtime secrets. Tokens for the config repo and the mesh VPN are separate
  encrypted parameters.
- Cloud API access uses the instance role, not keys. Loki reaches its S3 bucket and
  Grafana reaches CloudWatch through the VM's instance profile. There are no AWS
  keys in any config file.

The instance role needs, scoped tightly: object read and write on the Loki bucket;
parameter read on the monitoring parameters; CloudWatch metrics read and Logs read
and Logs Insights (`StartQuery`, `GetQueryResults`, `StopQuery`) for the Grafana
CloudWatch datasource; container-platform task discovery (`ListTasks`,
`DescribeTasks`) for the Prometheus target script; and the managed SSM core policy
for shell and tunnel access.

A note on secret hygiene before you publish or share this: the source repo shipped a
real-looking SMTP password in an example env file and kept a populated `.env` next
to it. Scrub example files of real values and confirm `.env` is gitignored.

## Storage and retention

Loki writes to object storage (S3 or compatible), so logs survive the box. Set
retention with the compactor (`retention_enabled: true`, a `retention_period`), and
add a storage-layer lifecycle rule a few days past that as a backstop in case the
compactor falls behind. Make the bucket `force_destroy` so a teardown can empty and
remove it in one step.

Prometheus keeps its TSDB on the local volume with a process-flag retention
(`--storage.tsdb.retention.time=30d`). That data is local, so it does not survive a
box rebuild. If you need durable metrics history, add `remote_write` to a long-term
store (Mimir, Thanos, or a managed Prometheus).

## Internal DNS

Give the box internal DNS names in a private zone so cross-host callers do not
hardcode an IP: `grafana`, `loki`, `prometheus`, `alloy`, `glitchtip`, all under
one internal domain, all pointing at the box's private IP. The app's log sidecars
target `loki.internal.example:3100`, the browser RUM proxy targets
`alloy.internal.example:12347`, the app's error DSN targets
`glitchtip.internal.example:8090`. When the box is replaced, update the records (or
let Terraform do it); the callers do not change because they use the name.

## Access (no public ports)

The security group exposes nothing to the internet. Every dashboard and API port is
restricted to the VPC, and SSH only from a bastion. Engineers reach it three ways,
all private:

- Port-forward over SSM Session Manager (primary). A script opens a session through
  the bastion to the internal host and forwards local ports. No SSH key, no inbound
  port, no public IP; the auth is your cloud credentials plus the IAM permission to
  start a session. Because the bastion resolves the internal names, the tunnels
  survive a box replacement without edits.

  ```sh
  aws ssm start-session --target "$BASTION_ID" \
    --document-name AWS-StartPortForwardingSessionToRemoteHost \
    --parameters "host=grafana.internal.example,portNumber=3001,localPortNumber=3001"
  ```

- A mesh VPN subnet router (browser-native). A tiny instance runs a mesh agent
  (Tailscale or similar) and advertises the VPC CIDR to the tailnet, with split DNS
  pointed at the VPC resolver. A laptop on the mesh opens
  `grafana.internal.example:3001` directly. The router has zero inbound rules; the
  mesh is outbound peer-to-peer.

- Bastion SSH plus a Session Manager shell on the box itself, for break-glass and
  for `docker compose` operations.

## The single-node tradeoff

Everything is on one box, Loki is single-replica with an in-memory ring. If the box
dies: Loki logs survive (object storage), the Prometheus TSDB is lost (local
volume), and the dashboards, datasources, and alert rules survive because they are
provisioned from files. So a rebuild restores the views and the logs, and loses
only local metrics history. That is an acceptable loss for many systems. If it is
not, add `remote_write` for metrics and run Loki and Prometheus in a replicated
mode, which is a different and heavier deployment.

EC2 over a container platform for the box itself is deliberate: the stack has
stateful volumes and reads the Docker socket (the collector and cAdvisor need it),
which is simpler on one VM than on a container platform with shared volumes.

## Decommissioning (and bringing it back)

Make the stack a clean toggle so you can turn it off to save cost. Two flags: one on
the app's log output (Loki on or off, falling back to cloud-log-only), one on the
monitoring module (the box exists or not). The order matters, because of the
back-pressure described in `instrumentation.md`:

- To tear down: set the app's Loki output off first and confirm cloud logging is
  healthy, then destroy the box. If you destroy the box while the output still
  points at it, the unreachable Loki host back-pressures the log buffer and drops
  application logs.
- To bring it back: recreate the box first (fresh object-storage bucket, DNS
  records), confirm Loki and Grafana are healthy, then turn the app's Loki output
  back on.

Two teardown sharp edges worth pre-empting. A targeted destroy of just the
monitoring module can hit a dependency error when another security group still
references the monitoring one (remove the cross-reference first). And a
`force_destroy` on the log bucket only takes effect once it has been applied to the
live bucket, so adding it in the same change that destroys the bucket leaves it
non-empty and the destroy fails; empty the bucket first.

## Adapting the blueprint

Hosted Grafana instead of self-hosted. Use Grafana Cloud and push metrics and logs
to it with `remote_write` and the Loki push API, or run Grafana Alloy as a forwarder
to Grafana Cloud. You drop the Grafana, Prometheus, and Loki containers and keep the
instrumentation and the collector. Simpler operationally, a recurring bill instead
of one VM.

Sentry instead of GlitchTip. GlitchTip is the self-hosted, Sentry-API-compatible
backend. To use Sentry's own service, change only the DSN; the SDK code is
identical. Going the other way is the same one-line change.

Add tracing. The source stack stored RUM and errors as logs and issues, not spans.
To add distributed tracing, run Tempo as a fourth store, instrument the app with
OpenTelemetry, and add a Tempo datasource plus a `derivedFields` link on the Loki
datasource so a log line jumps to its trace.

Kubernetes instead of Compose. Run the same components as a Helm-installed stack
(kube-prometheus-stack, Loki, Grafana, Alloy as a DaemonSet). The collection model
changes (Alloy as a DaemonSet tailing pod logs, ServiceMonitors for scraping) but
the four-signal model, the label taxonomy, and the provisioned dashboards carry over
unchanged.

Managed metrics and logs. Swap self-hosted Prometheus for Amazon Managed Prometheus
or Mimir, and self-hosted Loki for a managed Loki, when retention or scale outgrow
one box. The instrumentation does not change; only the storage and query endpoints
do.

## Known gaps to fix (do not copy blindly)

- Pin every image to a real version. The source ran almost everything on `latest`,
  which is not reproducible.
- Confirm the `job` label your alert rules query matches the series Prometheus
  actually stores, or the prod alerts never fire.
- Decide and wire a config-update path; git-clone-at-boot with no live reload
  silently drifts from the repo.
- Use real internal hostnames in alert message templates, not `http://localhost`.
- Do not define the host and container exporters twice across two compose files
  under the same container names; they collide.
- Scrub example env files of real secrets and gitignore the live `.env`.
- Single hardcoded `env` labels (a local collector tagging RUM as `production`) mix
  environments; thread the real environment through.
