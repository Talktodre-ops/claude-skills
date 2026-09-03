# Heimly decision journal

Dre's personal engineering brain for the Heimly build: every significant decision,
what we chose, why, what we rejected, and what would make us change our mind.
Designed to be lifted into an external indexed vault (Obsidian-style) later, so:

- One decision per file, in `decisions/`, named `YYYY-MM-DD-<slug>.md`.
- Frontmatter: `date`, `status` (proposed | accepted | superseded | deferred),
  `tags`. Wiki-links `[[like-this]]` between related records.
- Body shape: **Context** (the situation), **Decision** (what we chose),
  **Why** (the reasoning that actually drove it), **Rejected** (alternatives and
  why not), **Revisit when** (the conditions that reopen it).
- Statuses change by editing the file, superseding records link to what replaced
  them. Never delete a record; a wrong decision documented is the most valuable
  kind.

Standing rule for Claude sessions: when a decision is made or changed in a
session, append/update its record here in the same pass, and keep
`.agents/phase2-build-plan.md` in sync when it touches the plan.

## Index

- [[2026-08-27-phase2-build-sequence]] — executive-ordered wave plan
- [[2026-08-27-grounded-research-rule]] — no volatile facts from memory
- [[2026-08-27-admin-console-design-workflow]] — HTML-first design iteration
- [[2026-08-27-preprod-hosting]] — Contabo/Oracle research (superseded by Azure)
- [[2026-08-28-feature-flags-d7]] — thin homegrown flags, ship-dark, kill switches
- [[2026-08-28-staging-demoted]] — testers on prod allowlist, staging on-demand
- [[2026-08-28-monorepo-tooling-d8]] — pnpm + Turborepo, not Nx/Bazel
- [[2026-08-28-rust-deferred]] — cost forensics beat the language argument
- [[2026-08-28-infra-remediation-pass]] — live drift fixed, TF aligned, alerting added
- [[2026-08-28-nin-uniqueness-d4]] — HMAC pepper digest design
- [[2026-08-28-playwright-local-only]] — E2E kept local, out of CI for now
- [[2026-08-28-branch-naming-multi-repo]] — `<slug>-fe` / `<slug>-be` pairing
- [[2026-08-28-migration-replay-repair]] — fresh-DB replay fixed, retro-edit lesson
- [[2026-08-28-manual-only-deploys]] — deploy is a button press, merge ships nothing
- [[2026-08-28-escrow-start-deferred]] — no payment work until planned
- [[2026-08-pre-existing-decisions-digest]] — back-catalog of earlier calls
- [[2026-09-02-analytics-build-args-and-consent]] — public ids as build args, opt-in consent
- [[2026-09-02-opensearch-3-7]] — 3.7 everywhere, cluster upgraded before the platform deploy
- [[2026-09-03-search-database-fallbacks]] — every read path degrades, scoped views opt in
- [[2026-09-03-offer-application-org-derived]] — org derived from property.owner, no column
