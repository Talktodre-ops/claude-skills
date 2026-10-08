---
date: 2026-10-08
tags: [frontend, dependencies]
---

# Regenerating a lockfile quietly pulls brand new versions

## What happened

Resolving the FE forward merge regenerated `pnpm-lock.yaml`, which moved `next` from the vetted 16.3.6 to 16.4.0, two days old.

## Why it bit

A caret range plus a fresh resolve takes whatever was published this week.

## The rule

After any lockfile regeneration, diff the resolved versions of the framework and security-sensitive packages and pin back to the vetted ones.

## How to spot it next time

A lockfile diff touching packages nobody asked to change.
