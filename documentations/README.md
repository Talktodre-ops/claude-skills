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

What went wrong, or nearly did, goes in the lessons folder (`../lesson/`), one
file per lesson, same conventions.

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
- [[2026-09-19-a-verdict-gate-without-a-scanner]] — the gate is built, the scanner is not, and the row says so
- [[2026-09-19-migrated-documents-keep-their-old-bucket]] — backfilled files stay put; relocate is a separate, restartable run
- [[2026-09-19-sale-agreements-keep-their-model-for-now]] — a sale is refused at the join rather than half split (superseded)
- [[2026-09-22-the-suite-never-touches-the-search-cluster]] — settings guard, because conftest sat above pytest's rootdir
- [[2026-09-22-ranking-scores-go-negative]] — the floor at zero was erasing quality on 24 of 27 listings
- [[2026-09-22-the-portfolio-asks-the-server-once]] — window and sort go to the server, everything else narrows in hand
- [[2026-09-22-marketing-ships-from-dev-not-pre-prod]] — pre-prod is an integration line, 52 migrations away from being shippable
- [[2026-09-22-gunicorn-threads-are-a-setting]] — the live edit was in the container's writable layer, one restart from gone
- [[2026-09-24-a-sale-is-its-own-record]]: plan, six steps, the rent pipeline; supersedes keeping sales on the lease
- [[2026-09-24-home-quotes-what-is-owed-now]]: monthly ledger, cycle headline, one number on both sides
- [[2026-09-24-service-charge-is-part-of-the-let]]: the offer's move in total and the roll finally agree
- [[2026-09-24-a-payment-report-carries-evidence]]: a reference or a proof, visible to both sides, shaped for escrow
- [[2026-09-24-past-homes-show-only-what-heimly-knows]]: backfilled history never shows money owed
- [[2026-09-25-google-measurement-stays-opt-in]]: GA4 and Ads opt-in; our own in-app count is for everyone, same event names
- [[2026-10-05-escrow-runs-on-payscrow-inside-one-walled-off-app]]: Payscrow holds, Paystack direct, payer pays the fee, provider fee from the API, release on confirm inside a window, one walled-off app with the DB as the record; supersedes escrow-start-deferred
- [[2026-10-08-production-runs-on-two-graviton-hosts]]: about $345 to $135 a month; API x2, Celery in bridge mode, fck-nat, EMQX by service discovery
- [[2026-10-08-search-runs-on-postgres]]: OpenSearch deleted; AND words, substring, trigram near-miss at 0.4
- [[2026-10-17-api-capacity-from-a-calibrated-copy]]: a calibrated copy found API CPU the wall; Argon2 at OWASP minimum, signed-out cache, keep-alive 65, max-requests 10000
- [[2026-10-19-no-funded-wallet]]: the Money page shows money the partners hold; sums of rows, never a balance; "Heimly credit" for the voucher credit
- [[2026-10-19-escrow-built-on-a-fake-provider-until-keys-arrive]]: a fake that signs real webhooks to our own endpoint; the Payscrow adapter is written but never selected without a key
- [[2026-10-19-owner-accepts-before-the-payer-can-fund-escrow]]: a protected payment binds both sides, so the owner side accepts before funding
- [[2026-10-19-agent-commission-comes-from-the-assignment-terms]]: the payer never decides the split; the assignment's percentage is the only source
- [[2026-10-19-payout-accounts-are-owner-only-and-never-edited-in-place]]: invites only to the owner's registered contact, name matched to the owner, supersede not edit, 24h cooling off
- [[2026-10-19-the-payments-kill-switch-ships-on]]: `payments_live` in the kill tuple, ON by migration, OFF stops new money movement only
- [[2026-10-19-auto-renew-charges-the-saved-card-from-the-account-app]]: current plan price, retries +2 and +5 days, PAST_DUE then grace, no card means off in the UI
- [[2026-10-19-side-effects-of-a-money-state-change-run-in-a-task-after-commit]]: the request returns at commit; notices, emails, chat lines and metrics run in a stamped task
- [[2026-10-19-payments-live-on-one-branch-per-repo-until-dre-says-merge]]: BE #240 and FE #211 stay open and unmerged until Dre says; all payments work goes there
