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

### database

Production-grade PostgreSQL for an app backend, distilled from a real multi-tenant
SaaS on Neon: connection pooling that does not exhaust the server, indexing the hot
paths, Postgres-native search instead of a separate cluster, and writes that survive
a retry.

The pool-times-processes math that causes "too many connections" and the small
pooled-endpoint fix, functional and partial indexes matched to the query and confirmed
with EXPLAIN, pg_trgm / native FTS / pg_search-BM25 / pgvector picked by the actual
need, and the idempotency, claim, and append-only-ledger patterns for retry-safe writes.

- [`database/SKILL.md`](database/SKILL.md): connections, indexing, search, idempotent
  writes, migration discipline, and the pre-production checklist.

### payment

Integrating Paddle Billing (a Merchant of Record) into a SaaS backend the reliable
way, distilled from a real FastAPI + Celery + React system.

Webhooks are the source of truth and the database is an idempotent projection of
Paddle's state, ingested through an inbox/outbox pipeline on the existing task
queue rather than a new broker. Covers the data model, the checkout, subscription,
and one-off/credit-pack flows, the verified Paddle event catalog and signature
scheme, and the edge cases that matter: out-of-order and duplicate webhooks, lost
deliveries, slow-network retries, dunning, refunds and chargebacks, cancel and
downgrade timing, currency, and reconciliation. With the tradeoffs stated.

- [`payment/SKILL.md`](payment/SKILL.md): the principle, the pipeline, the data
  model, the flows, the Paddle specifics, the edge cases, the tradeoffs, the build
  order, and the non-negotiables.

### multi-tenant

Keeping one tenant's data out of another tenant's view in a shared-database SaaS,
distilled from a system that shipped a real cross-persona leak and then closed it.

The active tenant is resolved only from an explicit request header, verified
against membership, and never guessed. The data boundary is the queryset filter,
not the permission class. Postgres row-level security is the defense-in-depth
backstop. Plus the frontend org context, the tenant-id and object lockstep, and
the cross-user cache wipe for shared browsers.

- [`multi-tenant/SKILL.md`](multi-tenant/SKILL.md): the four-layer model, the one
  rule that prevents the bug class, do's and don'ts, and the non-negotiables.
- [`multi-tenant/references/backend.md`](multi-tenant/references/backend.md):
  resolution, queryset scoping, permission classes, and row-level security done
  right.
- [`multi-tenant/references/frontend.md`](multi-tenant/references/frontend.md):
  the org context, the lockstep invariant, and the cross-user wipe.

### infra

Production AWS infrastructure with Terraform and GitHub Actions, proven on a
Django and ECS system through a full cost-saving teardown and rebuild.

The environment-and-module layout, the reversible feature-toggle pattern, S3
state with native locking, OIDC for CI auth with no static keys, the
plan-before-apply discipline, the safe ECS deploy ordering, least-privilege IAM,
the security posture behind a load balancer, secrets through SSM, and the
private-by-default access model. With explicit do's and don'ts and the gotchas
that bit in production.

- [`infra/SKILL.md`](infra/SKILL.md): the principles, the layered model, build
  order, and a full do and don't list.
- [`infra/references/terraform.md`](infra/references/terraform.md): structure, the
  reversible toggle pattern, state, and the plan-before-apply discipline.
- [`infra/references/cicd-deploy.md`](infra/references/cicd-deploy.md): OIDC, the
  approval gate, the infra-to-app handoff, and the safe ECS deploy ordering.
- [`infra/references/security-secrets-access.md`](infra/references/security-secrets-access.md):
  secrets, least-privilege IAM, the load-balancer posture, and private access.

### loop

How to run a long, multi-phase build autonomously with a self-continuing loop,
distilled from shipping a large batch one phase at a time without losing
correctness or context.

One phase per fresh context window; orient from the git log rather than memory;
make the smallest correct change per sub-plan; verify it for real before
committing; commit and push one sub-plan at a time; then checkpoint to the next
phase with a scheduled wake-up that hands the full spec and updated progress
forward. Pairs with a project-guide skill for the repo's own commands and a
house-rules skill for voice and commit conventions.

- [`loop/SKILL.md`](loop/SKILL.md): the rhythm, the shape of a loop prompt, the
  per-sub-plan steps, the checkpoint and stop conditions, and the checklist.

### testing

How to test a full-stack app to a shipping bar. The test layers (unit, integration,
contract, end-to-end, smoke, regression, security), what to run per change versus per
release, the cross-viewport visual discipline, and the principle that a green
type-check is not a green feature. Fetches current framework docs with Context7.

- [`testing/SKILL.md`](testing/SKILL.md): the method, the layers, when to run what,
  and the non-negotiables.
- [`testing/references/frontend.md`](testing/references/frontend.md): type-check and
  lint, unit and component tests, Playwright e2e, and the cross-viewport visual harness.
- [`testing/references/backend.md`](testing/references/backend.md): unit and
  integration tests, async patterns, seed-and-cleanup, live probes, and contract tests.
- [`testing/references/security.md`](testing/references/security.md): authorization
  and tenant isolation, injection, upload safety, secrets, and dependency scanning.

### clean-code

Standards for writing, refactoring, and reviewing source so it stays readable and
correct: comment the why not the what, intention-revealing names, small
single-purpose functions, explicit error handling, and the smells to watch for.

- [`clean-code/SKILL.md`](clean-code/SKILL.md): the principles and the pre-merge
  checklist, with language notes for Go and TypeScript/React.

### dre-house-rules

Standing defaults for tone and craft: a direct, plain voice, no em dashes, the AI
tells to avoid, and the safety and code conventions to hold to. A personal
house-rules skill; adapt the specifics to your own.

- [`dre-house-rules/SKILL.md`](dre-house-rules/SKILL.md).

### ui-styling, ui-ux-pro-max

Building accessible interfaces. `ui-styling` covers shadcn/ui (Radix plus Tailwind),
utility-first Tailwind, and canvas-based visual design, with reference material and
canvas fonts. `ui-ux-pro-max` is a design-intelligence pack of styles, color
palettes, font pairings, product types, UX guidelines, and chart types across many
stacks, with data and templates.

- [`ui-styling/SKILL.md`](ui-styling/SKILL.md), [`ui-ux-pro-max/SKILL.md`](ui-ux-pro-max/SKILL.md).

### design, design-system, brand, banner-design, slides

A design toolchain: brand identity and voice, three-layer design tokens, logo and
banner generation, corporate-identity deliverables, and strategic HTML presentations
with Chart.js.

- [`design/SKILL.md`](design/SKILL.md), [`design-system/SKILL.md`](design-system/SKILL.md),
  [`brand/SKILL.md`](brand/SKILL.md), [`banner-design/SKILL.md`](banner-design/SKILL.md),
  [`slides/SKILL.md`](slides/SKILL.md).

### ian-xiaohei-illustrations

Generating Ian-style whimsical hand-drawn illustrations for Chinese articles (the
"Xiaohei" IP), with style references and example assets. The skill content is in
Chinese.

- [`ian-xiaohei-illustrations/SKILL.md`](ian-xiaohei-illustrations/SKILL.md).

## Using a skill

Copy or symlink a skill directory into `~/.claude/skills/` (global) or a project's
`.claude/skills/` directory. Claude Code loads it when a task matches its
description, or you can invoke it by name.
