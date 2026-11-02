---
date: 2026-11-02
tags: [tooling, dead-code]
---

# A scan that finds nothing needs a known positive

## What happened

Two dead-code scans returned nothing. The first (unused exports) compared `./components/x.ts` with `components/x.ts`, so every file counted as using its own exports. The second (routed endpoints against the frontend) ran through this shell's `grep`, which is ugrep: `grep -rln -- "$path" --include=*.ts` treated the include flags as file names after `--`, warned, and searched everything.

## Why it bit

An empty result reads as "clean", which is exactly the answer you were hoping for.

## The rule

Every scan is first run against something known to match (a file you know is used, an export you know is unused). Normalise paths before comparing. In this shell, put `--include` before `-e PATTERN` and never after `--`.

## How to spot it next time

Zero hits on a codebase this size, or warnings like "--include=*.ts: No such file or directory".
