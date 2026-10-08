---
date: 2026-10-08
tags: [search, production, testing]
---

# Compare old and new against live data before switching paths

## What happened

Running the same marketplace queries against OpenSearch and the new Postgres path in production found `bedrooms_min` returning 500 on Postgres (it read the wrong column). It was live for about an hour before the fix.

## Why it bit

The test suite used fixtures where the column difference did not show.

## The rule

Before switching a read path, run a scripted live comparison of every filter, read only, and fix every difference that is not by design.

## How to spot it next time

A filter that only real data exercises.

Related: [[2026-10-08-search-runs-on-postgres]]
