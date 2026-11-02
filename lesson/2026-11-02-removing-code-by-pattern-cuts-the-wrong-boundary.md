---
date: 2026-11-02
tags: [refactoring, tooling]
---

# Removing code by pattern cuts the wrong boundary

## What happened

Three scripted removals in one session went wrong at the edges. Cutting `set_main_image` from its `@action` to "the next `def`" removed only the decorator, because the next `def` was its own. The second pass took the following section comment with it. Removing a test function left its `@pytest.mark.django_db` decorator at the end of the file, a syntax error found only when the suite failed to collect.

## Why it bit

A regex knows text, not structure: decorators belong to the function below them, and comments above a block belong to the next block.

## The rule

After any scripted removal, read the diff at every boundary (`git diff -U2 | grep -E "^@@|^ "`) and parse or collect the file before moving on. Prefer cutting from the decorator to the next decorator or class-level comment, and check what was removed matches the line count you expected.

## How to spot it next time

A removal that reports 1 line for a 70-line method, a section comment missing from the diff context, or a test file that ends in a decorator.
