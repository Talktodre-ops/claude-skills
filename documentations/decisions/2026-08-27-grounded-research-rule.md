---
date: 2026-08-27
status: accepted
tags: [process, research, quality]
---

# Grounded research rule: no volatile facts from memory

**Context.** Claude quoted Hetzner pricing from training memory as current fact;
Hetzner had raised prices up to 2.75x. The recommendation built on those numbers
was wrong, and it would have gone to stakeholders.

**Decision.** A standing skill (`~/.claude/skills/grounded-research`): any
volatile fact (prices, plans, quotas, versions, availability, vendor claims) must
be verified live against primary sources before being presented, with as-of
dates, two-source confirmation for decision-driving numbers, and an explicit
"unverified" label when live checking is impossible. Research results are cached
dated in `.agents/research/` with freshness windows.

**Why.** Confidence is not correctness. The failure mode is systematic (training
data ages, prices only move up), so the fix must be systematic, a process rule,
not a one-time correction.

**Rejected.** "Be more careful" (not enforceable); always-research-everything
(wasteful for stable facts like algorithms or our own code).

**Revisit when.** Never in substance; the mechanics can improve.
