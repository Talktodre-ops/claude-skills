---
date: 2026-08-27
status: accepted
tags: [planning, phase2, sow]
---

# Phase 2 build sequence, executive-ordered

**Context.** The Phase 2 SOW lists everything to ship but no order. Executives set
priority: (1) MVP stabilization + bug fixes + admin portal, (2) referral system,
(3) escrow POC, (4) infrastructure; onboarding UX rides with the UI redesigns.

**Decision.** A gated wave plan (W0 foundation hardening → W1 bugfixes → W2 admin
→ W3 referrals → W4 escrow POC → W5 infra → W6 UI/onboarding/owner-privacy →
W7-W9 payments/action-center/marketplace, plus Rent Ops and AI flex tracks), with
decisions D1-D8 locked before the work they gate, and a standards gate (STD 1-8)
every PR must pass. File of record: `.agents/phase2-build-plan.md`.

**Why.** The SOW mixes one-week fixes with multi-month systems; without gates the
risky work (money, NIN, marketplace) starts on sand. W0 exists because "tested
and verified" was fiction: FE tests were gitignored and lint was broken. The
executive order governs shipping, the gates govern correctness.

**Rejected.** Building in SOW document order (front-loads UI while payments risk
stays undiscovered); starting escrow early (needs alarms and org-isolation
guarantees first).

**Revisit when.** Executive priorities change, or a wave's exit gate proves
unreachable in reasonable time.

Related: [[2026-08-28-feature-flags-d7]], [[2026-08-28-escrow-start-deferred]]
