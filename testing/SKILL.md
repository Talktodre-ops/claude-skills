---
name: testing
description: How to test a full-stack app to a shipping bar, distilled from a real recruiter-led SaaS. Covers the test layers (unit, integration, contract, end-to-end, smoke, regression, security, performance, accessibility), what to run per change versus per release, the cross-viewport visual discipline (mobile, tablet, desktop, wide), the "verify for real" principle that a passing type-check is not a passing feature, hermetic stubbed e2e, tenant-isolation as a standing regression gate, and the file-upload and authorization security checks that keep a multi-tenant app safe. Load when writing tests, setting up a test harness, deciding what to verify before a commit, or reviewing whether a change is actually safe to ship. Fetch current framework docs with Context7 rather than from memory.
---

# Testing to a shipping bar

The bar is "safe to ship after a review", not "looks done". Confidence in the
output means nothing on its own; only verifiable correctness counts. A green
type-check is not a green feature, and a test that cannot fail is worse than no
test because it buys false confidence. Every claim that something works must trace
to a check that actually exercised it.

This skill is the testing method. It pairs with a project-guide skill that supplies
the exact commands for a given repo (how to run the suite, the container, the
migration runner) and a house-rules skill for voice and commit conventions.

## The layers

Think of tests as a pyramid, cheap and many at the bottom, expensive and few at the
top. Each layer answers a different question.

- **Unit**: does this function do the right thing on its inputs, including the
  edges (empty, null, zero, max, duplicate, out-of-order, partial failure)? Fast,
  deterministic, no I/O. The bulk of the suite.
- **Integration**: do these units work together across a real boundary (a DB, a
  queue, an HTTP handler)? Seed real data, exercise the boundary, assert, clean up.
- **Contract**: does the API still return the shape the client expects? Guards the
  frontend/backend seam so a rename does not silently break a page.
- **End-to-end (e2e)**: does a real user flow work in a real browser across the
  stack? Few, high value, the ones a demo would show. Cross-viewport (below).
- **Smoke**: after a deploy, do the critical paths respond at all? A handful of
  fast checks (health, login, load a list, one write) that gate a release.
- **Regression**: a standing suite that must stay green on every change, anchored
  by the bugs you never want back. In a multi-tenant app the anchor is a
  tenant-isolation test: prove org A cannot read or mutate org B.
- **Security**: authorization, input validation, injection, file-upload safety,
  secrets, rate limits, dependency and static analysis (see `references/security.md`).
- **Performance and accessibility**: budgets on the paths that matter (a slow query,
  a janky list) and WCAG basics (keyboard, contrast, labels), so quality is measured,
  not assumed.

## What to run, and when

Per change, before you commit a sub-plan:

1. The **type-check and linter** at zero new errors.
2. The **unit tests** for what you touched, plus the **integration test** for the
   boundary you changed (the endpoint, the task, the query).
3. The **e2e or visual check** for any screen the change touches, eyeballed.
4. The **regression gate** (tenant isolation and the other standing tests), which
   must stay green even when it seems unrelated. Data-isolation regressions hide in
   unrelated diffs.

Never commit red. If a check fails, fix the root cause; do not weaken the test to
make it pass.

Per release:

- The **full suite** green.
- **Smoke** against the deployed environment.
- A **security** pass on anything that touched auth, uploads, or tenant scoping.

## Verify for real

- Exercise the actual endpoint or function, not a mock of it, for the thing under
  test. Mock only the far edges (third-party APIs, object storage) and say so.
- Seed throwaway data through the real path, assert on real output, and clean it up
  (or run inside a transaction you roll back), so the suite is repeatable and leaves
  no residue.
- Make tests deterministic. No sleeps-as-synchronization, no reliance on wall-clock
  or random ordering, no shared mutable state between tests. A flaky test is a bug.
- Test behavior and contracts, not implementation details, so a refactor does not
  rewrite the suite. Name each test for its scenario and expected outcome.
- When something genuinely cannot be verified here (a live phone call, real
  third-party credentials, a scheduled job firing in production, perceptual audio or
  video quality), say so and mark it **needs-human-check** rather than claiming it
  works.

## Cross-viewport visual discipline

A UI is not done until it has been seen at the sizes real users use. Screenshot and
**eyeball** every changed screen at four widths:

- mobile 390 x 844, tablet 834 x 1150, desktop 1440, wide 1920.

Layouts must fill the space on desktop (not cram into a narrow centered column),
stack on mobile, and go multi-column on tablet. A snapshot that renders blank is a
failure even if the assertion passed; look at the image.

## Fetching current docs (Context7)

Test frameworks and their assertions change across versions. Do not answer from
memory for a version-specific API. Use the **Context7** MCP to pull current docs:
`resolve-library-id` to get the library id (for example `/microsoft/playwright`,
`/vitest-dev/vitest`), then `query-docs` for the specific concept (a matcher, a
fixture, a config flag). Prefer this over guessing an import or a flag that may have
moved.

## Non-negotiables

- The regression gate (tenant isolation first) is green on every commit.
- No flaky tests in the suite; quarantine and fix, do not retry-until-green.
- Every bug fix ships with a test that fails without the fix.
- Uploads are validated by content-type, extension, and magic bytes; a renamed
  executable is rejected (see `references/security.md`).
- Secrets never appear in tests, logs, URLs, or fixtures.
- A feature without a test that exercises it is not done.

## References

- [`references/frontend.md`](references/frontend.md): type-check and lint, unit and
  component tests, Playwright e2e, hermetic stubbing, and the cross-viewport visual
  harness.
- [`references/backend.md`](references/backend.md): unit and integration tests,
  async patterns, seed-and-cleanup, live probes, DB isolation, and contract tests.
- [`references/security.md`](references/security.md): the security-testing checklist,
  from authorization and tenant isolation to injection, uploads, secrets, and
  dependency scanning.
