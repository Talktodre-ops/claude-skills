---
date: 2026-08-28
status: accepted
tags: [architecture, frontend, tooling, d8]
---

# D8: FE monorepo on pnpm workspaces + Turborepo

**Context.** The admin becomes its own app but must share dependencies with the
main FE (one central dependency, update once, both follow). Candidates: plain
pnpm workspaces, Turborepo, Nx, Bazel/Buck/Pants.

**Decision.** pnpm workspaces + Turborepo for FE-heimly: `apps/web`,
`apps/admin`, `packages/ui`, `packages/api-client` (generated from the DRF
swagger schema), `packages/config`. Module boundaries enforced by an ESLint
import-restriction rule, not a framework. BE stays in its own repo.

**Why.** The actual need is "don't rebuild/retest everything on every CI run";
Turborepo's input-hash caching solves exactly that with one small config, and
being Vercel-owned it fits Next.js natively. It layers over plain workspaces, so
adopting it costs nothing and leaving it costs nothing.

**Rejected.** Nx (its distinctive value is enforced boundaries + generators;
at this team size an ESLint rule gets 80% for 5% of the adoption; it remains the
upgrade path). Bazel/Blaze-class tools (hermetic polyglot builds pay off only
with a polyglot monorepo and a build team; BE in a separate repo removes their
selling point; the JS+Bazel path is famously rough). Merging FE+BE into one repo
(atomic cross-stack commits are the prize, but the generated api-client already
gives most of that contract safety across two repos).

**Revisit when.** Team growth makes generators/boundaries valuable (→ Nx), or
cross-repo contract drift starts producing real bugs (→ single repo debate).
