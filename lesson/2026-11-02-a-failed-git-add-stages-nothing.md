---
date: 2026-11-02
tags: [git]
---

# A failed `git add` stages nothing, and the commit still goes

## What happened

`git add` was given fifteen paths, one of which had been renamed earlier with `git mv`. Git refused the whole command over that one path, so nothing new was staged; the chained `git commit` still ran and pushed a commit holding only the earlier rename, under a message describing all the changes. The fix had to be a second commit, because history is never force-pushed.

## Why it bit

The `add` error scrolled past inside a chained command, and `git commit` does not care what you meant to stage.

## The rule

Chain `git add ... && git status --short && git commit`, and read the status (every intended file shows in the first column) before committing. Never pass a path that a `git mv` already moved.

## How to spot it next time

"fatal: pathspec ... did not match any files" anywhere in the output, or `git show --stat HEAD` listing far fewer files than the message describes.
