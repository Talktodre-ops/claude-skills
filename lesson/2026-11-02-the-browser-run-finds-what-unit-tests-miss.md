---
date: 2026-11-02
tags: [testing, assistant, e2e]
---

# The browser run finds what unit tests miss

## What happened

The assistant's edit mode passed its unit tests. The Edge run on a real listing found three bugs in a few minutes: the reply listed "Purpose: For rent" as a change although the listing was already to let (the model repeats what the listing says); continuing on the phone showed the new-listing message "That is everything the steps need ... Go to photos"; and the "needed" count showed 5 of 6 because the purpose only counted once the assistant had asked. A fourth surfaced while reading it: a free message without a question makes the fill rewrite the title and description.

## Why it bit

The unit tests fed the model's reply as written; the real model returns the whole listing back, and a resume path the tests never took had its own copy.

## The rule

A screen build is not done until it has run in Edge against real data, and its tests use replies shaped like the model's real output (unchanged values included). On edit, only values that differ count as changes.

## How to spot it next time

A summary that lists fields the person never mentioned, or a progress count that disagrees between two devices.
