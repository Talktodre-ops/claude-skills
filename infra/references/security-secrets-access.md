# Security, secrets, and access

How credentials are handled, how runtime gets its permissions, the app posture
behind a load balancer, and how humans reach private resources. Generalized
placeholders: `<account-id>`, `<env>`, `app.example.com`, `internal.example`.

## Secrets

Three distinct patterns, each for a different ownership story. Do not collapse them
into one.

One, secrets Terraform reads but does not own. Database credentials and the app
signing key are created once per environment as SecureString parameters outside
Terraform, and read through data sources. Their values never enter `.tf` or state.

```hcl
data "aws_ssm_parameter" "db_password" {
  name            = "/myapp-<env>/db/password"
  with_decryption = true
}
```

Two, a Terraform-owned config blob. The whole app env file is delivered as one
parameter sourced from a gitignored file. Note it is a `String` of `Advanced` tier
(the blob can exceed the 4 KB Standard limit), and it has no `ignore_changes`, so
every apply overwrites it from the file. That is exactly why a stale local copy is
dangerous and why this apply belongs in CI, where the file is written fresh from
secrets.

```hcl
resource "aws_ssm_parameter" "app_env" {
  name      = "/myapp-<env>/deploy/app-env"
  type      = "String"
  tier      = "Advanced"
  value     = var.app_env_content     # from file("app-env.<env>"), gitignored
  overwrite = true
}
```

Three, the canonical "Terraform provisions, humans or rotation own the value." Create
the parameter as a SecureString and ignore later value drift, so Terraform seeds it
once and never reverts a rotated secret.

```hcl
resource "aws_ssm_parameter" "service_env" {
  name      = "/myapp-<env>/service/env"
  type      = "SecureString"
  value     = var.service_env_content
  lifecycle { ignore_changes = [value] }
}
```

Delivery into the container. The task definition injects parameters by ARN through
the native `secrets` mechanism; the values are never in the task-definition JSON
(only the ARNs), the image, git, or CI logs. The entrypoint materializes the blob to
a locked-down file before exec'ing the app.

```hcl
secrets = [
  { name = "POSTGRES_PASSWORD", valueFrom = var.db_password_parameter_arn },
  { name = "SECRET_KEY",        valueFrom = var.signing_key_parameter_arn },
  { name = "APP_ENV",           valueFrom = var.app_env_parameter_arn },   # the whole .env blob
]
```

```sh
# container entrypoint
printf "%s" "$APP_ENV" > /app/.env && chmod 600 /app/.env && exec <start the app>
```

Do this on every task that needs the env, including worker and scheduler tasks, or
they start without their config and crash-loop.

## IAM least privilege

Two role types for runtime, both scoping access to the project namespace.

Execution role versus task role on ECS. The execution role is used by the ECS agent
to pull the image and inject the secrets; grant it the managed execution policy plus
`ssm:GetParameters` on exactly the parameter ARNs the task needs. The task role is
assumed by the application for its own AWS calls; scope it to just what the app
touches (its bucket, its log groups). Keeping these separate means the application
cannot read every parameter the agent can.

```hcl
# execution role: only the specific parameters this task injects
statement {
  actions   = ["ssm:GetParameters"]
  resources = [var.db_password_parameter_arn, var.signing_key_parameter_arn, var.app_env_parameter_arn]
}
# task role: only the app's own bucket
statement {
  actions   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
  resources = ["${var.app_bucket_arn}/*"]
}
```

Instance roles instead of keys. Every EC2 gets an instance profile, never an access
key. The managed SSM core policy gives Session Manager access (so no SSH key is
needed), and any extra permission is a scoped inline policy. A discovery box, for
example, gets only `ecs:ListTasks` and `ecs:DescribeTasks` plus reads on its own two
parameters.

Conditions on top of resource scoping. Pin the cluster on `ecs:RunTask` with an
`ArnEquals` on `ecs:cluster`, and restrict `iam:PassRole` to the specific ECS role
ARNs with `StringEquals { "iam:PassedToService" = "ecs-tasks.amazonaws.com" }`, so the
CI role can pass only those roles and only to ECS.

## The app posture behind a load balancer

The load balancer terminates TLS and speaks plain HTTP to the app, setting
`X-Forwarded-Proto`. Without `SECURE_PROXY_SSL_HEADER`, `request.is_secure()` is
always false, Django drops the HSTS header, and secure cookies are not set. This is a
real and confusing production symptom.

```python
# settings.py, behind a TLS-terminating load balancer
if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SECURE_SSL_REDIRECT = False          # the load balancer does HTTP to HTTPS; True would loop
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    X_FRAME_OPTIONS = "DENY"
    SECURE_CONTENT_TYPE_NOSNIFF = True
```

Trusting `X-Forwarded-Proto` is safe only because the load balancer overwrites it on
every request, so a client cannot spoof it. `SECURE_SSL_REDIRECT` is false because the
load balancer already redirects; if Django also redirected you would get a loop, but
the proxy header must still be set so Django believes it is on HTTPS and emits HSTS.

Discover the container's own IP for the host allow-list, since health checks hit the
task by its rotating private IP:

```python
ALLOWED_HOSTS = [h for h in os.environ.get("ALLOWED_HOSTS", "").split(",") if h] or [
    "app.example.com", "localhost", "127.0.0.1",
]
try:
    uri = os.environ.get("ECS_CONTAINER_METADATA_URI_V4")
    if uri:
        meta = json.loads(urllib.request.urlopen(uri, timeout=1).read())
        for net in meta.get("Networks", []):
            ALLOWED_HOSTS.extend(net.get("IPv4Addresses", []))
except Exception:
    pass     # never let a metadata fetch failure crash boot
```

## Security groups and networking

Reference security groups, not CIDRs, for service-to-service rules. The app tasks
accept their port only from the load balancer's group; the database accepts its port
only from referenced groups. Gate optional rules with a `dynamic` block so an absent
subsystem produces no rule and the group still plans.

```hcl
# app tasks: only from the load balancer SG
ingress {
  from_port = 8000  to_port = 8000  protocol = "tcp"
  security_groups = [aws_security_group.alb.id]
}

# database: only from an allow-list that may be empty
dynamic "ingress" {
  for_each = length(var.allowed_security_group_ids) > 0 ? [1] : []
  content {
    from_port = 5432  to_port = 5432  protocol = "tcp"
    security_groups = var.allowed_security_group_ids
  }
}
```

Compute, database, cache, and search live in private subnets with no public IP
(`assign_public_ip = false`), egress through a NAT gateway. Only the load balancer's
group opens to the internet, on 80 and 443. A single NAT gateway is a cost-versus-
resilience tradeoff: cheaper, but one AZ's NAT is a shared dependency. The database is
not publicly accessible, is encrypted, and is multi-AZ.

## Access (no public shells, no inbound)

Three tiers, all outbound-only, all identity-tied through IAM and SSM, none requiring
an open SSH port.

Routine reach, a mesh subnet router. A small instance runs a mesh agent (Tailscale or
similar), advertises the VPC CIDR to the tailnet, and uses split DNS pointed at the
VPC resolver, so a laptop on the mesh opens `service.internal.example` directly. Its
security group has zero inbound rules; the mesh is outbound peer-to-peer. The auth key
is read from a parameter at boot and unset after registration.

```sh
tailscale up --advertise-routes="${vpc_cidr}" --accept-dns=false --ssh=false
```

Port-forward without any open port, SSM Session Manager. A script discovers the
bastion by tag and forwards local ports through it to private hostnames. The auth is
your AWS credentials plus `ssm:StartSession`; nothing is exposed.

```sh
aws ssm start-session --target "$BASTION_ID" \
  --document-name AWS-StartPortForwardingSessionToRemoteHost \
  --parameters "host=grafana.internal.example,portNumber=3001,localPortNumber=3001"
```

Break-glass, the bastion itself. No public IP, SSH closed by default (a `dynamic`
ingress over an allow-list that is empty), access via Session Manager with only the
managed SSM core policy on its role.

One repeated gotcha worth pinning: filter the AMI to the full variant, not a wildcard
that also matches the `minimal` image, which ships without the SSM agent and leaves the
box unreachable through Session Manager. Pin the family pattern, for example
`al2023-ami-2023.*-x86_64`, not `al2023-ami-*`. Install any debug tooling best-effort
(no `set -e` in user data) so one missing package cannot leave SSM unconfigured.
