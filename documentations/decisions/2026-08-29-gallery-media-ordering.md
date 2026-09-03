# Gallery media ordering and the main photo

**Date:** 2026-08-29
**Status:** Accepted
**PRs:** BE-heimly #104, FE-heimly #81 (extended)

**Context.** Property images had no user-controllable order: serializers sorted
main-first then insertion order, edit could not reorder or re-star saved
images, and every edit upload batch marked its first file is_main (so
properties accumulated multiple mains). Dre asked for click-hold drag
reordering across create, edit, and drafts, videos included, plus a main badge
that actually stands out.

**Decision.** Display order and the main photo are two separate concepts.
A `position` column on PropertyFiles and PropertyVideoURL is the single
source of gallery order everywhere; `is_main` stays an independent flag used
for the card cover and the prominent badge, settable on any image. One
endpoint, PATCH properties/{uuid}/reorder-media/, takes a full image
permutation, an optional main id, and a video permutation, validates all keys
before writing anything, and mirrors remove-file's permission rule.
Positions backfilled from the old main-first ordering so existing listings
render unchanged.

FE: one merged gallery (saved + queued images) with pointer-event drag, no
library; mouse lifts on a movement threshold, touch on a short hold so swipes
still scroll. Create uploads in drag order (positions match for free) and
flips the main afterwards only when the starred photo is not first; edit maps
the arrangement to uuids from the upload response and calls reorder-media;
drafts persist the arrangement in form data. Queued video uploads start after
the order call so a fast upload cannot invalidate video_order.

**Rejected.** Making the first image implicitly main (Dre wants the star kept,
made clearer); dnd-kit or similar (a dependency for one screen); per-file
position PATCHes (permutation-in-one-call keeps order atomic and validation
trivial).

**Revisit when.** Unit-level image galleries need ordering (unit FK exists on
PropertyFiles but unit images are out of scope here).
