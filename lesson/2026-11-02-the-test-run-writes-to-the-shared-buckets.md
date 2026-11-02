---
date: 2026-11-02
tags: [testing, storage, r2]
---

# The test run writes to the shared buckets

## What happened

New draft-publishing tests saved listing photos and passed. Later, while removing dead code, a check of the default storage class showed `R2PublicMediaStorage`, not the local disk: the api container has the R2 variables set, so `PropertyFiles.file.storage._save` uploads for real even under pytest. The fixture that set `MEDIA_ROOT` to a temp folder did nothing. Listing the buckets found 20 test images in `property_media/` from this session, and 11,003 generated documents (203 MB, one month) in the documents bucket from every Rent Ops run, all under organisation ids that exist only in the test database.

## Why it bit

The test database is isolated; storage is not, and nothing failed, so it never showed. `MEDIA_ROOT` only matters for `FileSystemStorage`.

## The rule

Tests never change real storage: the root conftest answers boto writes and deletes ([[2026-11-02-tests-never-change-real-storage]]). Before trusting a storage fixture, print which storage class the code actually uses.

## How to spot it next time

List objects by `LastModified` after a test run; match keys against rows on Neon. Tiny objects (75 or 633 bytes) or keys under unknown organisation ids are test debris. Related: [[2026-10-19-the-test-run-shares-the-live-cache]].
