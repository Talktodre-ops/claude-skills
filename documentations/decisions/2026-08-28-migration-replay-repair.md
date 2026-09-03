---
date: 2026-08-28
status: accepted
tags: [backend, migrations, ci, sprint0]
---

# Migration chain repaired for fresh-database replay

**Context.** Sprint 0 committed the hidden test suites and every DB-backed test
errored: the migration chain could not replay on a fresh database. Prod and dev
never noticed because they migrated incrementally. Three distinct defects, all
invisible until something tried to migrate from zero:

1. Early migrations (property/0004, tenant/0002) had been RETRO-EDITED after
   later migrations were applied, adding uuid columns that later migrations
   (property/0008, tenant/0006/0017/0018, task/0008) also add → duplicate
   column on replay, 7 collisions.
2. account/0039 (RLS policies) touches tables owned by social_django,
   token_blacklist, property, tenant, chat, and task with no dependencies
   declared → "relation does not exist" on replay.
3. Beat-row migrations (account/0045 pattern) depended on
   django_celery_beat 0001_initial while get_or_create uses the CURRENT model,
   whose columns only exist after later dcb migrations → "column timezone does
   not exist".

**Decision.** Repair in place rather than rewrite history: duplicate AddFields
wrapped in `RunSQL('ADD COLUMN IF NOT EXISTS ...', state_operations=[original])`
so SQL is idempotent while recorded state stays byte-identical; missing
dependencies added (0039 pinned to each touched app's newest-table creator;
beat-row migrations pinned to the installed dcb head 0019). Editing applied
migrations is normally taboo; it is sanctioned here because already-migrated
databases never re-run them, so recorded and actual state stay consistent, and
ordering-only dependency additions cannot change applied schemas.

**Why.** The alternative (squash everything into a fresh chain) is a bigger,
riskier change for the same outcome. The gate that keeps this fixed forever is
Sprint 0 Phase 4's migrate-on-scratch-DB CI step; and the standing rule stays:
never edit an applied migration to add schema, append a new one.

**Rejected.** Full squash (risk without benefit now); `--fake` workarounds in
CI (hides the disease); leaving it broken (blocks every DB-backed test).

**Revisit when.** A future squash consolidates the chain properly, or Django
upgrade forces one.

Related: [[2026-08-27-phase2-build-sequence]]
