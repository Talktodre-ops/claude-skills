---
name: heimly-guide
description: Project guide for the Heimly workspace (FE-heimly + BE-heimly + Infra-Heimly). Load alongside the loop skill for any autonomous or multi-phase build here, it supplies the repo facts the loop skill expects a project guide to carry: stack map, multi-repo branch convention, exact run/test/migrate commands, CI gates, feature-flag rules, and the gotchas that have already wasted time once.
---

# Heimly project guide

The workspace root is `C:\Users\VICTUS\Documents\GITHUB\Heimly-FE-BE`. It is NOT a
git repo. Inside it are three independent repos plus support folders:

| Repo | Stack | Default branch |
|------|-------|----------------|
| `FE-heimly` | Next.js 16, TypeScript, TanStack Query, App Router | `dev` |
| `BE-heimly` | Django REST Framework, Celery, Postgres, ES, EMQX, in Docker | `dev` |
| `Infra-Heimly` | Terraform (AWS prod), GitHub Actions deploy | `dev` |

Support folders (not shipped): `.agents/` (plans, file of record:
`.agents/phase2-build-plan.md`), `claude-skills/` (skills + the decision journal in
`claude-skills/documentations/`), `heimly-doc/`.

## Multi-repo branch convention

One feature = one slug, suffixed per repo. Example: NIN hardening →
`nin-hardening-fe` in FE-heimly and `nin-hardening-be` in BE-heimly.

- The paired branches carry ALL work for that feature, both sides, until the
  feature is done through and through. Do not scatter one feature across many
  branches per repo.
- If a feature touches only one side, only that one branch exists.
- Branch off `dev`, PR into `dev`. Never commit to `dev` directly. Merging PRs is
  Dre's call, never the loop's.
- One commit per sub-plan inside the branch (the git log is the progress record).
- Commits and PRs carry ZERO AI attribution: no Co-Authored-By, no
  "generated with", no session links. Author is Dre's identity only.
- PR bodies are humanized plain prose (what changed, why, why safe to merge),
  ASCII punctuation only (no em dashes, no arrows, no emoji). Never put
  needs-human-check lists, open questions, decision requests, or phase/loop
  narration in a PR; anything needing Dre goes in the end-of-work chat summary.
- Multi-line commit messages: write to a file, `git commit -F <file>`.

## Running things

- Backend runs in Docker; container `be-heimly-api-1`. Every manage.py call:
  `docker exec be-heimly-api-1 sh -c "python /usr/local/app/others/manage.py <cmd>"`
- Migrations: same pattern with `migrate <app>`. In deploys, migrations run via a
  GitHub Actions ECS one-off task (entrypoint.sh is wired to nothing).
- Celery beat is django_celery_beat DatabaseScheduler: periodic tasks are DB rows;
  the code's beat_schedule is only a seed. New periodic tasks get their rows
  created in a migration (pattern: `account/migrations/0045`).
- Frontend: `npm run dev` in FE-heimly. On this Windows host run npm/npx through
  PowerShell, never Git Bash (Git Bash mangles the npm shim path). Git Bash also
  mangles leading-slash args (SSM parameter names, log-group names): prefix
  `MSYS_NO_PATHCONV=1` when an argument starts with `/`.
- Dev servers live on 8080 (web) and 8081 (admin), from the main FE-heimly
  checkout. Check with `Get-NetTCPConnection` first: if one is already up, use
  it and never kill it; if it is not, start it on that same port. Do not invent
  another port, and do not run a second server for the same app. The backend
  CORS allowlist only admits 3000, 8080, 8081, 8091 and 8092 anyway, so a
  server anywhere else is refused at sign in.

## One checkout per repository (2026-09-18)

BE-heimly and FE-heimly are the only checkouts. Do not clone them, copy them,
or add a git worktree beside them: folders like `BE-heimly-export` or
`BE-heimly-baseline` at the monorepo root are noise Dre has to clear twice
over, and a second backend checkout also drifts from the one the api container
serves. The container serves BE-heimly, so switch that checkout to the branch
you need and restart gunicorn instead.

If parallel work genuinely needs a second tree, it goes under `.worktrees/`
inside the repository it belongs to, never at the root, and you remove it with
`git worktree remove` as soon as its PR is open. The same applies to any agent
you spawn: say this in its brief.

## Tests and verification

- BE DB-backed suites: do NOT verify them locally against Neon (a test-DB
  build there takes 20+ minutes). Push the branch and let the PR's CI run be
  the verification: it runs the full suite against throwaway postgres/redis/ES
  service containers in single-digit minutes, from a fresh DB every time.
  Local pytest is only for quick non-DB logic checks.
- FE: `npx tsc --noEmit`, `npx eslint .`, `npx jest`. Playwright is installed but
  LOCAL-ONLY (config and `e2e/` are in `.git/info/exclude`, do not commit them, do
  not add to CI until Dre says so). Use `npx playwright test` against the running
  dev stack as the visual/E2E verification step for any FE change.
- BE: pytest inside the container; org-isolation smoke suite lives in
  `smoke-test/`. Migration safety: `makemigrations --check`, and migrate against a
  scratch DB before trusting a migration.
- The bar is the loop skill's: verify real behavior before commit, never commit
  red, never weaken a test to pass it.

## Feature flags (decision D7)

Features that are multi-week, risky (money/auth/core flows), or demo-in-prod merge
dark behind a flag: `FeatureFlag` model, `flags.enabled(name, user, org)` service,
flags delivered in the auth bootstrap payload, `useFlag()` on the FE. Flag created
in the feature's first PR, deleted in its last (after 100% + soak). Permanent flags
are kill switches only (paystack, qoreid, email). While old and new paths coexist,
migrations must be expand/contract. Plan/role gating stays in PlanLimitService and
RoleGuard, never in flags.

## Architecture facts that bite

- Org scoping: active org comes ONLY from the `X-Organization-ID` header; never
  guess or infer it. Chats, listings, everything is strictly per-org.
- Ownership chain: `Property.owner` = Organization; `Organization.owner` = User.
- Two-phase property creation: metadata first (15s timeout), images in background.
- Plan limits centralized in `account/services/plan_limits.py`; UNLIMITED = 999.
- Auth is HTTPOnly-cookie based with refresh interceptors; forms must have
  `method="post"` (hydration-race credential leak guard).
- EMQX is unclustered: never run two broker tasks at once (deploy is
  stop-then-start on purpose).
- TanStack: property detail has three query-key shapes; edits must remove all
  three or stale media lingers. Mutations take `{onSuccess, onError}` as the
  second arg to `.mutate()`.

## Secrets and infra

- Secrets live in SSM Parameter Store under `/heimly-prod/...` and `/heimly-dev/...`
  as SecureStrings, injected as env vars via ECS task-definition `valueFrom`.
  Never hardcode, never log, never put in command text.
- Prod DB access is read-only via the bastion with SSM send-command + dockerized
  psql (password fetched on-box). Tailscale route is dead.
- Record any important AWS value that CLI/Terraform returns in
  `Infra-Heimly/INFRA_REFERENCE.md` (gitignored, local source of truth).

## Decision journal

Significant decisions (what, why, alternatives rejected, revisit-when) are
recorded as one markdown file each in `claude-skills/documentations/decisions/`,
Obsidian-style with wiki-links. When a loop or session makes or changes a
decision, append a record there in the same format, and update
`.agents/phase2-build-plan.md` when the decision touches the plan.

## FE UI state conventions (2026-08-29)
Reusable state components live in src/components/ui and are the only way to
render these states; never hand-roll them per screen:
- Tooltip (tooltip.tsx): every hover hint. No native title attributes on
  interactive elements (exceptions: pattern-input validation titles, iframe
  accessibility titles, heading-style title props).
- LoadingState (loading-state.tsx): page, section, and inline variants; the
  inline variant is the save/progress indicator (spinner + label + hint).
- EmptyState (empty-state.tsx) and ErrorState (error-state.tsx): all empty
  and error renders; ErrorState takes an optional onRetry.
- Spinner (spinner.tsx, shadcn): the only spinner primitive; no hand-rolled
  border-spin spans. shadcn registry components are pulled with
  npx shadcn add <name> (components.json exists).
- RequiredTag (required-tag.tsx): required form fields show this pill, not
  an asterisk.
