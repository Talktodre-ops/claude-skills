---
date: 2026-11-02
status: accepted
tags: [security, uploads, listings]
---

# A listing only takes photos and videos we hold

## Context

`file_urls` on property create and update accepted any URL as a listing photo, the presigned batch endpoint signed any content type into the public `property_media/` folder, and video confirm-upload accepted any `media_url` and trusted the size the browser sent for the plan's video allowance. Neither the batch endpoint nor `file_urls` was called by the web or admin apps.

## Decision

`file_urls` and `generate-upload-urls` were removed; photos are uploaded or taken from the listing draft. Signed uploads (profile photos, listing videos) name the object from its type, never from the browser's file name. Video confirm takes only `property_videos/<uuid>.<ext>` in our own storage, reads the real size from storage for the allowance, deletes a refused upload and keeps one video per upload. `organization` on a listing is read-only, since an edit could set it to any account's id.

## Why

Anything the browser names (a URL, a size, a file name, a foreign key) is attacker-controlled. Each of these let a request make a listing point somewhere else, understate its storage, or move across accounts.

## Rejected

- Keeping `file_urls` with a strict allowlist: it was dead, and the only way to make valid URLs was the endpoint being removed.

## Revisit when

A native app needs direct-to-storage photo uploads; build it on the draft photo tickets, not on `file_urls`.

Related: [[2026-11-02-listing-photos-get-a-type-check-not-a-malware-scan]].
