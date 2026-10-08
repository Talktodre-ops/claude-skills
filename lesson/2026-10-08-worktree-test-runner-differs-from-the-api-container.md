---
date: 2026-10-08
tags: [testing, tooling]
---

# A different test runner environment produces failures the code does not have

## What happened

Under the worktree runner (fresh container, the worktree's `.env`), plain `pre-prod` failed five tests (seeded feature flags, a query budget) that pass in the live API container. They first looked like regressions from a merge.

## Why it bit

Same code, different environment variables and container state.

## The rule

Before blaming a change, run the same failing tests on the base branch under the same runner. Report which runner produced a result.

## How to spot it next time

Failures that also appear on the untouched base.
