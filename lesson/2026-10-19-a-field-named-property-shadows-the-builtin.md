---
date: 2026-10-19
tags: [django, python, payments]
---

# A model field named `property` shadows the builtin and breaks the class body below it

## What happened

The Transaction model declared `property = models.ForeignKey(...)` and, further down the same class, used `@property` for a computed attribute. Python resolves the decorator name in the class body, where `property` was now the ForeignKey, so importing `payments.models` raised `TypeError: 'ForeignKey' object is not callable`. Every test in the repository failed to collect, including another builder's unrelated account tests, and that builder lost six minutes retrying before reading the traceback.

## Why it bit

Heimly's domain word is "property", and every other model that links to one is named the same way, so the field name was natural. The failure only appears once a `@property` follows the field in the same class, and the error names ForeignKey, not the decorator.

## The rule

In a class that has a `property` field, use `builtins.property` for computed attributes (or put them above the field, or name the field `listing`). A collection-wide failure that names a Django field type as "not callable" is a shadowed builtin; read the line, do not retry.

## How to spot it next time

`'ForeignKey' object is not callable` at import; every test file erroring at collection at once. See [[2026-10-08-worktree-test-runner-differs-from-the-api-container]].
