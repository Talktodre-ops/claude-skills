---
date: 2026-10-08
tags: [github-actions, ci]
---

# GitHub environment secrets only reach jobs that declare the environment

## What happened

The new arm64 image build job could not assume the AWS role: `AWS_ROLE_ARN` was an environment secret, and only the approved deploy job declares the environment.

## Why it bit

Splitting one job into a build matrix plus a deploy job moved the build outside the environment without anything saying so.

## The rule

Secrets a pre-approval job needs (OIDC role for pushing by digest) are repo-level; keep what only the approved job may use at environment level.

## How to spot it next time

`Credentials could not be loaded` in a job that has no `environment:` key.
