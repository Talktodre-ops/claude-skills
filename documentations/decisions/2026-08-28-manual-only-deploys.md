---
date: 2026-08-28
status: accepted
tags: [delivery, ci, deploy]
---

# Prod deploys are manual-only, decoupled from merge

**Context.** Both repos' deploy.yml triggered on push to dev, so merging a PR
WAS deploying to prod. Dre planned to hold nine reviewed PRs open until
midnight to avoid shipping during usage hours.

**Decision.** Removed the push trigger; deploy.yml keeps only
workflow_dispatch. Merging to dev runs CI and ships nothing; deploying is a
deliberate Run-workflow press in Actions, once per repo, at a moment someone
chooses and watches.

**Why.** Merge-equals-deploy couples two decisions that have different right
times: merge when review finishes, deploy when someone alert is watching. The
midnight-window instinct was really about that coupling; low traffic matters
less than an awake operator. This also completes the D7 philosophy: flags
decouple release from deploy, this decouples deploy from merge.

**Rejected.** Scheduled midnight auto-deploys (nobody watching the failure
case); keeping push-to-deploy and batching merges (holds reviewed work
hostage to the deploy window).

**Revisit when.** The team grows enough to want continuous deployment with
proper canary automation, or a release-tag flow replaces branch dispatch.

Related: [[2026-08-28-feature-flags-d7]], [[2026-08-28-staging-demoted]]
