---
date: 2026-10-08
tags: [postgres, debugging]
---

# A setting can come from the client, not the server

## What happened

RDS showed `statement_timeout = 0` and Neon showed 30000, which looked like a gap. Both were Django's own connection option `-c statement_timeout=30000`: the psql session used to check did not send it.

## Why it bit

`SHOW` reports the current session, and the checking session is not the app's.

## The rule

Before calling a setting missing, check the app's connection options, role defaults and database defaults, and read it from a connection the app opened.

## How to spot it next time

A server value that disagrees with what the app observably does.
