---
date: 2026-11-02
tags: [drafts, react, sync]
---

# Tidying on load is not a change

## What happened

The first edit-draft design compared the form with the listing as loaded and saved a draft on any difference. The wizard fills in the country, strips a caution row on a sale and normalises a few fields as its steps mount, so a person who only opened the page and clicked a step would have saved an empty draft, and been offered "Carry on with your changes?" next time.

## Why it bit

"Differs from what loaded" includes the app's own adjustments, which no one typed.

## The rule

The baseline is the form as it stands when the person first types, taps or pastes; until then every change is the app's. Related: [[2026-11-02-changes-to-a-listing-are-a-draft-until-update]].

## How to spot it next time

A draft or "unsaved changes" prompt after only opening a page.
