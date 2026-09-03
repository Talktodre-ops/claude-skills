---
date: 2026-08-28
status: accepted
tags: [process, git, delivery]
---

# Multi-repo branch pairing: `<slug>-fe` / `<slug>-be`

**Context.** FE-heimly and BE-heimly are separate repos, but most features span
both. Branches named independently per repo made it impossible to see at a
glance which frontend work belongs to which backend work.

**Decision.** One feature = one slug, suffixed per repo: NIN hardening →
`nin-hardening-fe` and `nin-hardening-be`. The paired branches carry ALL the
feature's work on their side until the feature is done through and through; a
single-sided feature has only its one branch. Branch off `dev`, PR into `dev`,
one commit per sub-plan, no AI attribution, merges are Dre's call. Codified in
the `heimly-guide` skill.

**Why.** The slug is the join key across repos: reviews, deploy coordination,
and the git-log-as-progress-record (loop skill) all get simpler when
`git branch` in either repo tells the same story. Pairing also keeps a feature's
full diff findable when it ships weeks later.

**Tension noted.** Branches "until done through and through" must not become
long-lived integration branches; [[2026-08-28-feature-flags-d7]] exists so that
work can merge to dev dark and often. The pairing names the workstream; flags,
not branch lifetime, provide the isolation.

**Revisit when.** The monorepo restructure lands (FE branches then span apps/
and packages/, same convention holds), or a third repo joins.
