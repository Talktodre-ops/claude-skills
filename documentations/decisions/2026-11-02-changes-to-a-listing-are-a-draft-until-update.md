---
date: 2026-11-02
status: accepted
tags: [listings, drafts, edit, assistant]
---

# Changes to a listing are a draft until Update property; the assistant works on edit

## Context

Dre asked for the same autosave on the edit wizard, the assistant on edit too, and for edit to reuse the add interface (it already rendered `PropertyWizard` in edit mode, without the assistant or server saving).

## Decision

One draft per person and listing (`ListingDraft.property`, partial unique indexes), apart from the new-listing draft, guarded by the right to edit that listing. Nothing reaches the live listing until Update property; new photos are taken from the draft the same way as on publish. A draft starts from the person's first real change: the baseline is the form as it stood when first touched, because the steps tidy a few fields on load. Another device is offered "Carry on with your changes?", told which device saved them and warned when the listing was saved again since. The assistant on edit opens with "Tell me what to change", writes only values that differ from the listing, leaves the title and description alone unless the message asks, and keeps its conversation per listing.

## Why

Autosaving straight to a published listing would put a half-typed price live. A per-listing draft reuses the whole sync design. The assistant's fill reads a free message as a full listing and rewrites the title and description, which is right for a new listing and wrong for a change.

## Rejected

- Saving edits live as you type: half-finished changes visible to the public.
- Locking a listing while someone edits: heavy for a rare conflict; the "saved again since" warning covers it.

## Revisit when

Two team members edit the same listing often enough to need a merge, or the assistant gains a separate "edit" prompt on the backend.

Related: [[2026-11-01-the-listing-in-progress-lives-on-the-server]].
