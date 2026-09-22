# Marketing measurement ships from dev, because pre-prod is not a release candidate

Date: 2026-09-22. Status: accepted. Source: Dre, needing the marketing request
in production while admin and RentOps are not ready for it.

## Decision

The GA4 and Google Ads work is cherry-picked onto a branch cut from `dev` and
merged back into `dev`, which is the branch every production deploy has been
dispatched from. It does not reach production by promoting `pre-prod`.

## Why pre-prod cannot be promoted

`pre-prod` was cut from `dev` and `dev` has not moved since, so `dev` is a
strict ancestor: 0 dev-only commits against 314 on the frontend and 214 on the
backend. That makes `dev` a clean base with nothing to revert, and it makes
`pre-prod` an integration line rather than a release candidate.

What sits on it is not shippable. On the frontend RentOps is not a separate
app: it lives in `apps/web` as real dashboard routes and goes out with the web
image. The backend is the one that settles it. `pre-prod` carries 52 migrations
`dev` does not have and three apps production has never seen, `rent_ops`,
`analytics` and `documents`, seventeen migrations in `rent_ops` alone.
Promoting it runs all of that against the production database.

The admin portal is the one thing that is not a risk here. The Dockerfile
builds `pnpm --filter @heimly/web` and ships only `apps/web/server.js`, so the
admin app is never in the production image whatever branch it is built from.

## What a branch to production actually needs

Nothing new. `deploy.yml` is `workflow_dispatch` only and checks out whatever
ref is chosen in the Actions UI, so "a branch that goes straight to prod" is a
base choice, not a plumbing problem. Deploying from `dev` rather than from the
feature branch keeps one release line of record.

## What was left behind, and why

The page view capture posting to `/api/v1/analytics/page-view/` stayed on
`pre-prod`. That endpoint belongs to the `analytics` app, which production does
not have. Marketing's `page_view` comes from gtag.js itself, so the spec loses
nothing by dropping it.

The four card contact layout stayed too. It belongs to a change that posts to
`/api/v1/chat/contact-support/`, also `pre-prod` only. The three card layout is
kept and the email and phone cards still report the reach-out.

Those two exclusions are the whole conflict surface: the cherry-pick produced
two conflicts, both on the contact page, both traceable to the commit that
rebuilt it.

## The cost this defers

`pre-prod` holds the original commit and `dev` now holds a differently resolved
copy. Merging `dev` into `pre-prod` will conflict once, on `contact/page.tsx`,
and resolving it in favour of `pre-prod` is correct and mechanical. One known
file at a known moment, against reverting 314 commits.

## Consequences

A tag id that is only a runtime value never reaches a prerendered page, because
Next.js inlines `NEXT_PUBLIC_*` at build time. GA4 learned this the hard way and
`NEXT_PUBLIC_ADS_CONVERSION_ID` now has the same Docker build argument and
deploy build-arg. Until the repository variable is set the Ads half of the tag
stays dark and only GA4 configures, which is a supported state rather than a
failure.

The production image had not been built since the workspace split, so it was
built and run before opening the pull request: it serves in two seconds, and
both tag ids, the Meta pixel and both conversion labels are inlined in the
client bundle, with Consent Mode declared denied in the prerendered head of
every route checked.

The sign up conversion label is the one from marketing's generated snippet.
Their own message says to obtain it from Google Ads, so the number it produces
is unconfirmed until someone checks it there.
