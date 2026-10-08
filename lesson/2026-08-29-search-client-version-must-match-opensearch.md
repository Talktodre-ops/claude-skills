---
date: 2026-08-29
tags: [opensearch, dependencies]
---

# A newer Elasticsearch client refuses OpenSearch while CI stays green

## What happened

`elasticsearch` past 7.13.4 refuses to talk to OpenSearch. CI ran real Elasticsearch, so it passed while production search would have broken.

## Why it bit

CI's service was not the engine production ran.

## The rule

CI services must be the same engine and major version as production. (OpenSearch is gone since 2026-10-08; the rule stands for every service.)

## How to spot it next time

A dependency bump that passes CI against a look-alike service.
