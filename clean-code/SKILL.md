---
name: clean-code
description: Standards for writing, refactoring, and reviewing source code so it stays clean, readable, and correct — the comment-why-not-what philosophy (avoid over-commenting), naming, function and module design, error handling, correctness and invariants, code smells, testing, and per-language idioms (Go, TypeScript/React). Use whenever authoring or editing code.
---

# Clean Code

Code is read far more than it's written. Optimize for the next person to read it (often you, in six months). A few principles applied *consistently* beat a long rulebook.

## North star
- **Readability over cleverness.** If it's clever, it had better earn a *why* comment — or be rewritten plainer.
- **Consistency over preference.** Match the surrounding code's style and patterns before imposing your own.
- **Correct → clear → fast, in that order.** Most code should stop at "clear"; optimize only what you've measured.
- **Least surprise.** A unit of code does what its name says, with nothing hidden.
- **Less code wins.** The best change often deletes. Don't add abstraction you don't yet need.

## Comments — explain WHY, not WHAT
Over-commenting is the most common mistake. Be ruthless:
- **Comment intent and rationale:** why this approach, a non-obvious constraint, a trade-off, a link to the spec/issue, a warning ("caller must hold the lock", "order matters — see invariant #3").
- **Never restate the code.** `i++ // increment i` is noise. If a comment just narrates mechanics, delete it.
- **If you need a comment to explain *what* it does, rename or refactor instead** so the code says it itself.
- **No commented-out code** — that's what version control is for.
- **No banners, changelogs, or author/signature comments** inside source.
- **Doc-comments on exported/public APIs only**, and only when they add what the signature doesn't.
- **Stale comments are worse than none.** When you change code, fix or delete its comments. Default to fewer.
- `TODO`/`FIXME` are fine when actionable and tied to context — not vague wishes.

## Naming
- Intention-revealing: the name says why it exists and how it's used.
- Speak the domain language; one term per concept, no synonyms.
- Length scales with scope — `i`/`ok` in a tight loop, descriptive at module/package level.
- No redundant context (`user.name`, not `user.userName`), no obscure abbreviations, no type-encoding prefixes.
- Booleans read as predicates: `isOpen`, `hasQuorum`, `canCancel`.

## Functions
- Do one thing, at one level of abstraction.
- Small — but driven by clarity, not a line count.
- 0–3 parameters; bundle related args into a struct/object. Avoid boolean parameters — split the function instead.
- Guard clauses and early returns over deep nesting (aim for ≤ 2–3 levels).
- Prefer pure functions; push side effects to the edges and name them honestly.

## Structure & modularity
- High cohesion, low coupling. A file/module should have one clear reason to exist.
- Dependencies flow in one direction; no cycles.
- Don't abstract prematurely — wait for the rule of three.
- DRY applies to *knowledge*, not coincidental resemblance. Don't couple unrelated code because it looks alike.

## Errors & failure
- Handle or propagate — never silently swallow.
- Add context when wrapping; preserve the original cause.
- Validate at boundaries (where external data enters); trust within.
- Don't use errors/exceptions for normal control flow.
- On failure, leave state consistent — finish the transaction or roll it all back.

## Correctness
- Name the **invariants** and protect them; assert them in tests.
- Make illegal states unrepresentable with types rather than runtime checks.
- Prefer immutability; copy at trust boundaries.
- **Never use floating point for money** — use integer minor units.
- Concurrency: prefer a single owner / single writer over scattered locks; document any shared state; run race detectors.
- Cover the edges: empty, null, zero, max, duplicate, out-of-order, partial failure.
- Make retryable operations idempotent.

## Smells to watch for
Long functions · deep nesting · magic numbers/strings · boolean parameters · primitive obsession · duplicated logic · god file/object · feature envy · premature optimization · leaky abstraction · dead or commented-out code · catch-all error handling · mutable global state · stringly-typed code.

## Consistency & tooling
- Obey the formatter and linter; don't fight them (`gofmt`, `prettier`, `eslint`).
- Follow the repo's established patterns over personal taste.
- No unused imports, variables, or dead code in the diff.

## Tests
- Test behavior and contracts, not implementation details.
- Test names state scenario + expected outcome.
- Arrange–Act–Assert; one logical assertion per test.
- Use property-based tests for invariants (conservation, balance, round-trips).
- Tests are code too — keep them clean, with minimal fixtures.

## Before you call it done
- [ ] Reads top-to-bottom without head-scratching; names are clear.
- [ ] No dead or commented-out code; comments explain *why*.
- [ ] Errors handled; edges covered; invariants tested.
- [ ] Formatter/linter clean; no debug prints left behind.
- [ ] Diff is minimal and focused — no drive-by churn.

## Language specifics
- **Go** → [references/go.md](references/go.md)
- **TypeScript / React** → [references/typescript-react.md](references/typescript-react.md)
