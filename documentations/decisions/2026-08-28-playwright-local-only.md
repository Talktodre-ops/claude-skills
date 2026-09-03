---
date: 2026-08-28
status: accepted
tags: [testing, ci, frontend]
---

# Playwright kept, local-only for now

**Context.** The CI gate needed an answer on E2E. Heimly's worst shipped bugs
(persona lease leak, cross-org chat, stale media caches, hydration credential
leak) all lived in the seam between individually-correct layers, the exact class
only a real browser walking real auth catches. But CI minutes are a concern.

**Decision.** Playwright 1.62 installed in FE-heimly (config + `e2e/` +
Chromium), kept OUT of git via `.git/info/exclude` and OUT of CI. It runs
locally as the verification layer for every FE change (loops run
`npx playwright test` against the dev stack before committing). Promotion to CI
happens only when Dre says commit it; the CI design is ready (compose the BE
from a registry `dev-latest` image, `seed_e2e` command, Playwright `webServer`
boots Next, storageState shares one real login).

**Why.** The bug-history argument for keeping the layer is empirical, not
theoretical; the CI-time concern is real but orthogonal, so the split (verify
locally now, gate CI later) captures the value without the minutes.
Discipline that keeps it cheap: ~10-15 core-journey specs, role/label selectors,
shared auth state, volume stays in jest/pytest.

**Rejected.** Dropping E2E entirely (pipeline goes blind to the seam); gating CI
on it now (Dre's call: minutes matter more today).

**Revisit when.** Dre greenlights committing it, or a bug ships that the local
suite would have caught in CI.
