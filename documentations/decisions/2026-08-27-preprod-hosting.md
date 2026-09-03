---
date: 2026-08-27
status: superseded
tags: [infra, preprod, cost]
---

# Pre-prod hosting research (superseded by Azure offer)

**Context.** AWS pre-prod was torn down for cost. Need a near-free box for the
full compose stack (API, celery, Redis, ES ~1GB heap, EMQX, nginx, Next.js) for
~5 beta testers; DB stays on Neon, media on R2.

**Decision (then).** Contabo Cloud VPS 6 (6 vCPU / 12GB, €7.50/mo incl. VAT,
verified 2026-08-27) as primary; Oracle Always Free (2 OCPU / 12GB Arm, $0, with
idle-reclamation caveats) as the $0 path; netcup VPS 1000 as quality hedge.
Hetzner ruled out after their 2026 price increases; Railway ruled out because
RAM-metered billing is the wrong shape for an always-resident stack (~3.5-5x
Contabo). Full dated research: `.agents/research/preprod-hosting-2026-08.md`.

**Superseded (2026-08-28).** Stakeholders have an Azure plan and will invite Dre;
pre-prod moves to Azure (their credits beat any paid VPS). Permission ask-list
prepared: guest invite, Owner on a dedicated resource group, app-registration
rights for GitHub OIDC, quota check, policy constraints, budget/credit expiry.

**Why the supersession is right.** The whole selection criterion was "closest to
free"; someone else's committed credits win that contest outright, and it puts
pre-prod inside the stakeholders' own tenancy.

**Revisit when.** Azure credits expire or the invite stalls; the Contabo pick
remains valid fallback (re-verify prices, 14-day freshness window).
