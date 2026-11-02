---
date: 2026-11-02
status: accepted
tags: [database, migrations, shared-db]
---

# A model is dropped in two releases: state first, table later

## Context

QoreID address verification and `submit-for-verification` were dropped on Dre's word. The `PropertyAddressVerification` model had a table. Neon is shared by local and pre-prod, migrations must be additive, and on deploy the migration runs while the old code is still serving.

## Decision

Release one removes the code and the model from Django's state with `SeparateDatabaseAndState(state_operations=[DeleteModel], database_operations=[])` (property 0086). The table stays. A later release drops `property_addressverification` once no running code knows it. Gold badge requests stay on the document upload path (`views/verification.py`), which already sets `verification_requested`.

## Why

Code still running during a deploy never meets a missing table, and the shared database keeps working for whoever runs an older branch.

## Rejected

- One migration that drops the table: breaks the old code during the deploy window and any branch still using it.

## Revisit when

After the release that carries 0086 reaches production: add the migration that drops the table.
