---
date: 2026-11-02
tags: [security, api]
---

# A URL, a size or a foreign key from the browser is not a fact

## What happened

One cleanup found three holes of the same kind. Property `file_urls` took any URL as a listing photo. Video confirm-upload took any `media_url` and the browser's `file_size` for the plan's video allowance, so a video could point at another site and the allowance could be understated. `organization` on a listing was in the serializer's field list and writable, so an edit could set it to another account's id (tasks look listings up by it).

## Why it bit

Each field was added for a client that would behave; the serializer's `fields` list makes everything writable unless listed as read-only.

## The rule

What we store is checked against what we hold: a URL must name an object in our storage, a size is read from storage, an owner comes from membership. Mirror fields go in `read_only_fields`. Review every serializer field and every request value with "what if the client lies?" Related: [[2026-10-19-review-money-paths-by-asking-who-gains]].

## How to spot it next time

A request field that is a URL, a size, a price, an id of another account's row, or a field named like `organization` or `owner` in `fields` but not in `read_only_fields`.
