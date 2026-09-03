# Analytics ids as build args; consent is a real opt-in gate

**Date:** 2026-09-02
**Status:** Accepted
**PRs:** FE-heimly #89, #90, #91

**Context.** Marketing needed the Meta Pixel. Auditing prod first showed GA
missing from every statically prerendered route (including /pricing and
/find-properties) because its id arrived as an ECS runtime env var, which a
build-time-inlined NEXT_PUBLIC_ read can never see on a prerendered page. The
cookie policy also promised, in bold, no advertising cookies without consent.

**Decision.** Both analytics ids are Docker build args sourced from GitHub
repository variables, not SSM or Terraform: a pixel id and a measurement id
are public by construction (readable in page source), so the secret pipeline
adds a release dependency without protecting anything, and rotation becomes
an edit plus a redeploy. This fixed the GA coverage gap and put the pixel on
the pages ads land on.

Consent is a genuine opt-in: nothing non-essential loads until a choice
exists, analytics and marketing are separate switches, reject sits beside
accept at equal weight in both banner states, and withdrawal (a footer link)
stops the running trackers and clears their cookies. The consent snapshot has
three states, with 'pending' for server render and hydration, because
collapsing it either direction flashes the banner at everyone or fires
trackers before consent. Events fire on outcomes, not clicks, and Purchase
carries the Paystack reference as its Meta eventID so a future Conversions
API mirror deduplicates by construction.

Advanced matching sends email and phone as values fbevents.js hashes with
SHA-256 in the browser before transmission, verified against the script
itself rather than the docs, because the privacy policy now asserts that
mechanism.

**Rejected.** Routing the ids through APP_ENV_PROD and Terraform (secret
theatre for public values). Klaro (activates scripts by rewriting text/plain
tags, which fights the next/script mounting model; it is free, that was not
the issue). A feature flag for the banner (flags are evaluated per
authenticated user at auth bootstrap, so anonymous visitors, the banner's
main audience, would always read OFF).

**Revisit when.** Marketing asks for the Conversions API, whose eventID
plumbing is already shipped, or EU traffic makes consent-mode granularity
worth revisiting.
