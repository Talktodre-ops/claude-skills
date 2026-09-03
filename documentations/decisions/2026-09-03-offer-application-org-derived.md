# Offer and Application org derived from property.owner, not stored

**Date:** 2026-09-03
**Status:** Accepted
**PRs:** BE-heimly #113

**Context.** Neither Offer nor Application has an organization column. Both
search documents guarded prepare_organization with hasattr against the
attribute that never exists, so every document indexed organization as null
and the landlord branches' organization.id filters matched nothing: landlord
offer and application lists via search were empty for as long as the
documents existed. The question was whether to add a real organization FK or
derive it.

**Decision.** Derive from property.owner in the documents, no new column. The
org of an offer or application IS the property owner's org, which is exactly
what both views' own comments define the stamp to mean, and it is the pattern
the maintenance document already established. Two reasons beyond avoiding a
migration: the maintenance view documents that its stored organization column
drifted from the true owner and deliberately scopes on property.owner_id
instead, so a stored stamp has already failed once in this codebase; and for
access control the derived value is semantically correct, since offers on a
property that changes owner org should follow the new owner, which a stored
stamp would prevent. A parity test pins the indexed id to property.owner_id
so the search filter and the database fallback cannot disagree.

Consequence to plan around: after the prod reindex, landlord offer and
application lists go from empty to populated. That is the fix landing, and
support should hear it framed that way.

**Rejected.** An organization FK with backfill and write-path stamping across
every creation flow (buys the maintenance drift problem back, freezes
visibility on ownership change, and nothing reads the historical stamp).
Leaving the null (the lists stay silently empty).

**Revisit when.** A product feature needs the historical issuing org rather
than the current owner, which is the one thing derivation cannot answer.
