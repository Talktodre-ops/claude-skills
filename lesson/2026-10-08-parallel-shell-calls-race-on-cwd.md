---
date: 2026-10-08
tags: [tooling, git]
---

# Parallel shell calls race on the working directory

## What happened

Three parallel calls each started with `cd` into a different repo. One `git push --delete` meant for Infra ran in FE (no matching branches, no damage), and a `git branch -d` reported branches as not found.

## Why it bit

Parallel calls share one shell's working directory.

## The rule

In parallel calls use `git -C <abs path>`, `gh -R owner/repo` and absolute paths. Anything relying on `cd` runs sequentially, and every destructive command names its repo explicitly.

## How to spot it next time

A git error naming the wrong remote URL.
