---
date: 2026-08-27
status: accepted
tags: [design, admin, workflow, frontend]
---

# Admin console design workflow: HTML-first, iterate, host

**Context.** The admin portal needs stakeholder-approved design. Claude Design
quota ran out mid-flow; stakeholders don't have Claude accounts; Figma adds an
account wall and flattens interactivity.

**Decision.** Design as interactive self-contained HTML: iterate in-session
(artifact with device toggle + all UI states), and/or import Claude Design output
and convert its template DSL to vanilla HTML with a small interpreter runtime.
Host the deliverable on Cloudflare Pages (`heimly-design.pages.dev`) so anyone
with the link clicks the real thing. Approved HTML seeds `packages/ui` directly.

**Why.** Stakeholders approve behavior, not pictures: they can open drawers, type
the BLOCK confirmation, switch roles. Zero account friction. And the approved
artifact is written in the same tokens/patterns the real admin will use, so no
design-to-code translation loss. Figma's plugin import (html.to.design) is
one-way and lossy; it stays a later option for a hired designer.

**Rejected.** Figma as the approval vehicle (accounts, static frames); screenshots
in a doc (no interaction, endless "what happens when I click" questions).

**Revisit when.** A dedicated designer joins (then Figma owns components and this
flow feeds it), or two design candidates need merging into one base.

Related: [[2026-08-28-branch-naming-multi-repo]]
