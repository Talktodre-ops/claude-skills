# claude-skills

A small collection of [Claude Code](https://www.anthropic.com/claude-code) skills.

## Skills

### auth

A blueprint for production-grade full-stack authentication and authorization,
distilled from a real Django + Next.js system.

It covers dual-transport JWT (HTTPOnly cookies for browsers, Bearer for API and
mobile), refresh rotation with blacklist and replay detection, stateless
validation plus per-token and per-user revocation, RBAC with persona and
organization roles, multi-tenant scoping from a single header, rate limiting,
caching, and the cookie, CSRF, CORS, and header posture for an app behind a
TLS-terminating proxy.

- [`auth/SKILL.md`](auth/SKILL.md): the entry point. Architecture, design
  decisions and their tradeoffs, build order, and the non-negotiables.
- [`auth/references/backend-django.md`](auth/references/backend-django.md): the
  Django, DRF, and SimpleJWT recipe with real code.
- [`auth/references/frontend-react.md`](auth/references/frontend-react.md): the
  React and Next.js recipe.
- [`auth/references/security-checklist.md`](auth/references/security-checklist.md):
  the ship checklist, the known gaps to fix, and how to adapt the blueprint to a
  single-tenant app, a mobile API, RS256, or TOTP 2FA.

### observability

A self-hosted, open-source observability stack and how to wire an app into it,
distilled from a real Django and ECS deployment.

Prometheus for metrics, Loki (with an S3 object store) for logs, Grafana as the
single query pane, Grafana Alloy for log collection and Faro browser RUM, and
GlitchTip (Sentry-API-compatible) for errors, on one Docker Compose host,
provisioned as code. App integration covers FireLens dual-write logs, Prometheus
scraping with service discovery, Faro RUM through a same-origin proxy, and the
Sentry SDK to GlitchTip, joined by a shared low-cardinality label taxonomy and a
request id.

- [`observability/SKILL.md`](observability/SKILL.md): the entry point. The four
  signals, the tool wiring, design decisions, and the non-negotiables.
- [`observability/references/stack-and-compose.md`](observability/references/stack-and-compose.md):
  the components, version pinning, and the Docker Compose and per-tool config.
- [`observability/references/instrumentation.md`](observability/references/instrumentation.md):
  how the app emits logs, metrics, browser RUM, and errors.
- [`observability/references/grafana-as-code.md`](observability/references/grafana-as-code.md):
  datasources, dashboards, and alerting provisioned from files.
- [`observability/references/deploy-and-access.md`](observability/references/deploy-and-access.md):
  single-host deploy, secrets and IAM, the private-access model, and adaptation.

## Using a skill

Copy or symlink a skill directory into `~/.claude/skills/` (global) or a project's
`.claude/skills/` directory. Claude Code loads it when a task matches its
description, or you can invoke it by name.
