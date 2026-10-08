---
date: 2026-10-08
tags: [postgres, search, performance]
---

# An index helps neither a tiny table nor a query it cannot match

## What happened

Asked to add trigram GIN indexes for search. Production had 104 listings, which Postgres scans whatever indexes exist, and the queries could not use a plain trigram index anyway: `icontains` is `UPPER(col) LIKE`, near misses call `word_similarity()` as a function, and the OR spans joined tables.

## Why it bit

It is easy to add an index and feel done. The planner decides, and it ignores indexes that do not match the expression or do not pay.

## The rule

Before indexing, check the row count and run `EXPLAIN` on the real query. Index the expression the query uses (`UPPER(col) gin_trgm_ops`), use operators (`%>`) not functions, and add the index when the table is big enough to notice.

## How to spot it next time

An index that `EXPLAIN` never shows.

Related: [[2026-10-08-search-runs-on-postgres]]
