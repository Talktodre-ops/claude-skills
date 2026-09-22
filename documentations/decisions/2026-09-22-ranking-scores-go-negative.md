# Marketplace ranking scores go below zero, because the floor was erasing quality

Date: 2026-09-22. Status: accepted. Source: Dre, who suspected the point
allocation had stopped working and was right.

## Decision

`compute_ranking_score` returns the score as computed. The `max(score, 0)` at
the end is gone. The weights are unchanged.

## Why

The score is quality minus age:

    +1000  sponsored
    + 500  featured
    +  20  per trust point, so at most 100
    +   5  per favourite
    -   1  per day since publication, capped at 365

Quality is worth about a hundred points and age subtracts up to three hundred
and sixty five. Flooring the result at zero meant every listing older than
roughly four months scored exactly zero, whatever its quality.

Measured on development data: **24 of 27 published listings scored 0**, and the
whole marketplace held four distinct scores. Ordering fell through to the
`-created_at` tiebreaker, which is why an unverified listing sat third on the
first page above verified ones.

Without the floor the same data holds 23 distinct scores across 27 listings,
and the top of the page is verified again.

## Why not retune the weights instead

Letting the number go negative preserves every relationship the weights were
written to express, at every age: sponsored above featured, featured above
trusted, trusted above merely recent. Changing the weights would have been a
product decision about what ranking means. This was a bug in how the number was
clamped, not in what it measured.

`Property.ranking_score` is a plain `IntegerField`, so it already stores
negatives.

## Consequences

The hourly `refresh_ranking_scores` task rewrites every published row, and the
index has to be reindexed afterwards for search to sort on the new values. A
reindex is part of applying this, not an afterthought.

Nothing had ever tested the formula, which is why it rotted quietly. Seven
tests now pin the relationships rather than the weights, so the points can be
tuned without rewriting them. They fail on the old formula with "four qualities
collapsed to {0}".
