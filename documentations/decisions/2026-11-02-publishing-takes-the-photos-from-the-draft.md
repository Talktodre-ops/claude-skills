---
date: 2026-11-02
status: accepted
tags: [listings, drafts, photos, performance]
---

# Publishing takes the photos from the draft; no second upload

## Context

With the draft on the server, its photos were already uploaded while the person worked. Dre: "can't that now make our listing creation really fast ... but you have to watch for race condition or repeating the images or resaving them." The first draft build uploaded a 2048px JPEG copy for other devices, while publishing made its own WebP copy at up to 3840px.

## Decision

The draft keeps the same copy publishing makes (WebP, up to 3840px), uploaded as photos are added. Publish sends the photo ids (`draft_photos`, `draft_main`, plus the device) instead of files. The server locks the draft, reads each object back, checks from the bytes that it is a JPEG, PNG or WebP of at most 20 MB, writes it to `property_media/`, and deletes the draft in the same transaction as the listing. A second publish of the same draft finds it gone and gets 409, so photos are never attached twice. A photo the draft lacks gives 400 `DRAFT_PHOTOS_MISSING` and the browser falls back to uploading the files. The page stops autosave and flushes a waiting change before publishing, and no longer sends its own "delete draft" request. Saves carry the version the browser last knew, so a late save cannot bring back a published draft. Videos still upload after publishing.

## Why

Publishing became one request with nothing to upload. Locking plus deleting in the listing's transaction is the simplest exactly-once guarantee. Matching the publish copy keeps listing quality unchanged and makes every device publish the same photo.

## Rejected

- Keeping the 2048px copy: a quality drop on every listing.
- Server-side `copy_object` between buckets: the bytes have to be read for the type check anyway, and writing through the storage class works in every environment.
- A client-side "already published" flag: two devices can both believe they are first.

## Revisit when

Videos move into the draft too, or photos need server-side resizing (variants), which would change what is stored.

Related: [[2026-11-02-listing-photos-get-a-type-check-not-a-malware-scan]], [[2026-11-01-the-listing-in-progress-lives-on-the-server]].
