---
date: 2026-11-01
status: accepted
tags: [listings, drafts, sync, mqtt]
---

# The listing in progress lives on the server; one device edits, the others follow

## Context

"Continue your listing" kept progress on the device only (localStorage plus IndexedDB), so it failed whenever someone switched devices or the browser cleared storage. Dre chose "build it server side". He then clarified: "the other device can follow live, not that both devices can type at the same time", and "it should just look like a normal editing going on", with no "following live" label.

## Decision

`ListingDraft`, one per person and account: the form, units, step, the assistant's conversation, the photo ids and a photo register, a version and the device that saved last. Autosave after a 1.5 second pause (at most every 8 seconds). A device saves only after the person typed, tapped or pasted on it since it last took in a change, so a watching device never writes back. Each save is announced on `user/<uuid>/listing-draft` over MQTT with the version and device only; other devices fetch the draft through the API. Two notices remain: a change that arrives while you type waits behind "Load changes", and a draft published or cleared elsewhere says on which device. The device keeps its own copy for offline. Drafts untouched for 30 days are deleted by a daily task.

## Why

One writer at a time needs no merge logic and still gives the follow-along Dre wanted. The MQTT broker has no topic ACL yet, so the message must never carry listing content; a version number is harmless if someone else subscribes.

## Rejected

- Real-time co-editing (CRDT or operational transform): not what Dre asked for, and a large build for a form.
- A visible "following your phone" state: Dre removed it; editing should look normal.
- Keeping it device-only and fixing the edge cases: the failure was the design, not a bug.

## Revisit when

The broker gets per-user ACLs (the payload could then carry the change itself), or two people on a team need to edit the same draft.

Related: [[2026-11-02-publishing-takes-the-photos-from-the-draft]], [[2026-11-02-changes-to-a-listing-are-a-draft-until-update]].
