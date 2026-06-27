---
name: multi-tenant-isolation
description: Blueprint for keeping one tenant's data out of another tenant's view in a shared-database SaaS. The active tenant is resolved only from an explicit request header, verified against membership, and never guessed. The data boundary is the queryset filter, not the permission class. Postgres row-level security is the defense-in-depth backstop, with the load-bearing role switch and the cast and connection-reuse gotchas that make it actually work. Plus the frontend org context that emits the header, the tenant-id and object lockstep that prevents unscoped requests, and the cross-user cache wipe for shared browsers. Use when building or auditing per-tenant or per-organization data isolation on a Django and React stack.
---

# Multi-tenant data isolation

How to keep org A from ever seeing org B's rows in a shared-database SaaS,
distilled from a system that shipped a real cross-persona leak and then closed it
for good. The patterns are concrete (the fail-safe resolver, the RLS migration
chain, the queryset scoping, the frontend lockstep) and the failure mode each one
prevents is named.

This file is the map. Two reference files hold the implementation:

- `references/backend.md`: tenant resolution, queryset scoping, permission
  classes, and Postgres row-level security with the parts most write-ups miss.
- `references/frontend.md`: the org context that emits the header, the lockstep
  invariant, and the cross-user wipe.

## The model: four layers, each a fallback for the one above

1. Tenant resolution (fail-safe). Read the active tenant only from an explicit
   header, verify the user belongs to it, and on any ambiguity scope to the user's
   own data. Never infer a tenant.
2. Queryset scoping (the real boundary). Every list query filters by the resolved
   tenant. This is what actually decides which rows exist.
3. Permission classes (authorize the action, not the rows). A permission class
   decides whether the user may perform the operation. It is not the data
   boundary.
4. Row-level security (defense in depth). Database policies that contain an
   application-layer bug. A backstop, not the primary boundary.

The frontend feeds layer 1 by emitting the header, and it has to do that without
ever sending it wrong (see the lockstep invariant in the frontend reference).

## The one rule that prevents the whole bug class

Resolve the active tenant only from the explicit header, verify membership, and
self-scope on ambiguity. Never guess.

The system this came from used to guess: when the header was absent it fell back
to "use the user's staff-role org, else any role's org." For a user who owned both
a personal (tenant) workspace and a landlord workspace, that guess silently
resolved the wrong one, and a personal lease surfaced under the landlord tab. The
fix was to stop guessing. If the header is missing, scope to the user's own rows.
If the header names an org the user does not belong to, do the same. Persona
switching becomes an explicit act (the UI sets the header), never an inference.

## The second rule: the queryset is the boundary, not the permission class

A user can pass `IsOrgMember` and still see zero rows, because `get_queryset`
scoped them out. Keep these jobs separate. The permission class answers "may this
user act in this org." The queryset filter answers "which rows belong to this org."
If you conflate them, a permission gate that passes "in any org the user belongs
to" (a reasonable thing for a multi-persona user) becomes a data leak, because the
gate said yes and nothing narrowed the rows.

## Build order

1. Write the resolver: active tenant from the header, membership-checked, None on
   ambiguity. Make it an idempotent standalone function, because for token auth the
   user is anonymous during middleware and the real resolution happens inside the
   view after authentication runs.
2. Scope every list queryset by the resolved tenant. This is the boundary.
3. Add permission classes for the action, reading roles scoped to the active org.
4. Add a smoke test that creates org A and org B, drives the real resolver and the
   real querysets, and asserts A cannot read B and the resolver fails safe.
5. On the frontend, build the org context that emits the header and keeps the
   tenant id and object in lockstep, and wipe per-user state when the user changes.
6. Optional but recommended: add Postgres row-level security as a backstop, with
   the role switch and cast fixes from the backend reference.

## Do

- Resolve the active tenant only from an explicit header, verified against
  membership (ownership, membership table, or an active role).
- Scope every list query by the resolved tenant. Treat the queryset as the
  boundary.
- On the frontend, write the tenant id (which drives the header) in lockstep with
  the tenant object (which drives the UI). They must never diverge.
- Wipe per-user cached state (local storage, IndexedDB, the query cache) when the
  signed-in user changes on the same browser.
- Reload or invalidate every query on a tenant switch so caches do not mix
  personas.
- Write a cross-tenant isolation test and run it in CI.
- If you add row-level security, switch to a non-bypass DB role per connection, or
  the policies are silently inert.

## Don't

- Do not guess the tenant when the header is absent. No "first org," no "admin
  org," no "most recent." Self-scope instead.
- Do not rely on the permission class as the data boundary.
- Do not label a cache (or a log stream, or a metric) by an unbounded tenant set
  and forget to clear it on switch.
- Do not put row-level security on the membership or org tables themselves; their
  policies reference each other and you get recursive evaluation.
- Do not treat row-level security as a hard boundary if background workers share
  the database role. It contains app bugs, not a compromised worker.

## Non-negotiables

- The active tenant comes from one explicit header, verified, never guessed.
- The queryset filter, not the permission class, is the data boundary.
- The frontend tenant id and tenant object move in lockstep.
- A test proves org A cannot read org B.
