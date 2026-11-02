---
date: 2026-11-02
status: accepted
tags: [testing, storage, r2]
---

# Tests never change real object storage

## Context

In the local stack the storage settings point at the R2 buckets that pre-prod also uses. Property tests had written 20 tiny images to `property_media/`, and Rent Ops tests had written generated documents to the documents bucket on every run: 11,003 objects, 203 MB over a month, under organisation ids that exist only in the test database.

## Decision

The root `BE-heimly/conftest.py` answers every boto write and delete (put, copy, delete, multipart) without the network, autouse, whatever path the code takes. Property tests also keep FileField saves in memory with a class-level `_save` patch. A test that checks what was written patches the client itself. The 11,003 leftover objects were deleted on Dre's word after checking with the base manager that none of their organisations exists on Neon; 185 real objects remain.

## Why

Guarding at the boto call catches every path at once (FileFields, the document library, direct client calls), including tests nobody writes carefully, which is what a guard is for.

## Rejected

- Fixing each test file: misses the next one.
- Pointing tests at a local disk storage: some code calls boto directly and would still reach R2.

## Revisit when

Tests get their own bucket or a local S3 (MinIO) in compose; then the guard can let writes through to it.

Related lesson: [[2026-11-02-the-test-run-writes-to-the-shared-buckets]].
