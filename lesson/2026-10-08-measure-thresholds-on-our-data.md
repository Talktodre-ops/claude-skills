---
date: 2026-10-08
tags: [postgres, search]
---

# Library defaults are tuned for someone else's data

## What happened

The pg_trgm default word similarity of 0.6 missed "nigria" for Nigeria. Measured on our rows, 0.4 catches it on short fields, but on descriptions 0.4 matches "pool" inside "polished", so long text stays substring only.

## Why it bit

Defaults are a guess about typical text; place names and short titles are not typical.

## The rule

Measure fuzzy thresholds on our own rows, per field type, with the typos real users make.

## How to spot it next time

A search for a misspelled place returning nothing.

Related: [[2026-10-08-search-runs-on-postgres]]
