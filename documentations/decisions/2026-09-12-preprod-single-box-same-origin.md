# Pre-prod is one box, and every host serves its own API

Date: 2026-09-12. Status: accepted. Source: Dre, continuing the pre-prod plan.

## Decision

Pre-prod runs the whole product on a single Azure VM: the API, celery, beat,
the broker, search, the cache, the three Next apps and the nginx that fronts
them. Images are built on the box from the checked out branch, so no registry
sits in the deploy path. Both repositories are cloned on the machine and the
secrets arrive by scp. Terraform is not used for it.

Four hostnames share one certificate. Each one serves its own app at `/` and
Django at `/api/`, rather than putting the API on a host of its own.

## Why

Azure has no managed OpenSearch, so splitting the stack buys nothing and costs
a second machine. Building on the box removes the registry, the credentials it
needs and the pull step, which is worth more than build speed on an environment
that deploys a few times a day.

Same origin per host is the important half. Production already works this way:
`www.heimly.ng` serves both the app and the API, which is why the MQTT URL is
`wss://www.heimly.ng/mqtt`. Keeping that shape means the auth cookie stays
first party, no request is cross origin, and CORS and SameSite cannot produce a
class of failure here that production would never see. It also keeps the
prometheus mount at the root and the jazzmin admin off the public surface,
since only the known prefixes reach Django.

## Consequences

- `ENVIRONMENT` must be `preprod`, not `docker`. The `docker` value pulls in a
  built in list of development origins, localhost and three bare EC2 addresses
  among them, as trusted cross origin credential sources. The real origins are
  supplied through `CORS_EXTRA_ORIGINS` and `CSRF_EXTRA_ORIGINS` instead.
- The broker publishes no host port, so it is reachable only through `/mqtt` on
  the edge. It is still unauthenticated, and per user topic ACLs stay open work.
- Email really sends from this box, because the console backend only applies to
  `local`. Campaign audiences must be seeded addresses.
- Blocked on Azure: our account has Contributor on the `heimly-dev` resource
  group only, and `Microsoft.Compute`, `Microsoft.Network` and
  `Microsoft.Storage` are unregistered on the subscription. Registering them is
  a subscription scope action we cannot perform.

## Supersedes

Nothing. It builds on the pre-prod branch decision of 2026-09-09 and the
sizing research, and settles the parts those left open.
