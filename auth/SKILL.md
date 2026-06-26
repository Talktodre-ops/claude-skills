---
name: production-auth
description: Blueprint for production-grade full-stack auth and authorization. Dual-transport JWT (HTTPOnly cookies for browsers, Bearer for API/mobile), refresh rotation with blacklist and replay detection, stateless validation plus per-JTI and per-user revocation, RBAC with persona and org roles, multi-tenant scoping from a single header, rate limiting, caching, and the cookie/CSRF/CORS/header posture for an app behind a TLS-terminating proxy. Backend recipe is Django/DRF + SimpleJWT; frontend is React/Next with a single-flight refresh interceptor. Use when building, reviewing, or hardening auth on this stack, or adapting the pattern to another one.
---

# Production auth blueprint

A complete, adaptable authentication and authorization system, distilled from a
production Django + Next.js app. It covers the parts that are easy to get wrong:
token transport, refresh rotation, revocation, access control, tenant isolation,
and the proxy-aware security posture. The code patterns use real SimpleJWT, DRF,
django-ratelimit, and TanStack Query APIs, not pseudocode.

This file is the map. The three reference files hold the implementation:

- `references/backend-django.md` for the Django/DRF/SimpleJWT recipe.
- `references/frontend-react.md` for the React/Next recipe.
- `references/security-checklist.md` for the ship checklist, the known gaps to
  fix, and how to adapt the blueprint (single-tenant, RS256, mobile-only, etc.).

Read the references when you reach that layer. Do not paste them wholesale; lift
the pattern and rename to the target project.

## What this gives you

A layered system where each layer has one job:

1. Transport: how a credential reaches the server (cookie for browsers, Bearer
   header for API/mobile clients).
2. Identity: who the user is (a signed JWT, validated statelessly).
3. Session lifecycle: short access tokens, long refresh tokens, rotation on
   every refresh.
4. Revocation: turning a stateless token off early (per-token blacklist for
   logout, per-user watermark for "log this account out everywhere").
5. Access control: persona roles and organization roles, evaluated per request.
6. Tenant scoping: which organization's data this request sees, resolved from a
   single header and never guessed.

The layers are independent. You can drop tenant scoping for a single-tenant app,
swap the signing algorithm, or run header-only auth for a mobile API, without
touching the others.

## Core design decisions (and the tradeoffs)

Dual transport. Browsers get the access and refresh tokens as HTTPOnly cookies,
so JavaScript can never read them (kills XSS token theft). API and mobile clients
send a `Authorization: Bearer` header. One authenticator handles both: the header
path is strict (any bad token returns 401), the cookie path is graceful (a failed
cookie returns anonymous so the browser can silently refresh and retry). The cost
of cookies is CSRF exposure, which you pay for with SameSite plus a cross-origin
setup (see the security checklist).

Short access, long refresh, rotate every time. Access lives 30 minutes, refresh
lives 7 days, and every refresh issues a new refresh token and blacklists the old
one. A stolen access token is useful for at most 30 minutes. A stolen refresh
token gets caught: when the original owner next refreshes, their (now blacklisted)
old token is rejected, which you treat as theft and use to revoke every session
for that user. This is the single most valuable pattern here.

Stateless validation, with two ways to revoke. JWT signature and expiry checks
hit no database, which is what makes JWT scale. But stateless means you cannot
"delete" a token, so you add two revocation primitives. A per-JTI blacklist (one
DB row per revoked token) handles logout and targeted kills. A per-user watermark
(one timestamp column, "any token issued at or before this is dead") handles
"log this account out everywhere" with a single write, no need to enumerate
tokens. The revocation check is a DB lookup on every authenticated request, kept
cheap by an index, and deliberately not cached (a cached "not revoked" would open
a revocation window).

Roles are per-organization and evaluated per request. There is no global "admin"
role baked into the token. A user has a persona (tenant, landlord, agent) and a
set of organization roles (owner, admin, member, external) scoped to each org
they belong to. Permission classes read these from the DB on each request, so
revoking a role takes effect immediately. The token carries identity, not
authorization.

Tenant scoping comes from one header, never a guess. The active organization is
read only from an `X-Organization-ID` header. If it is absent or the user does
not belong to that org, the request scopes to the user's own data. It never falls
back to "their first org" or "their admin org," because that silently leaks one
persona's data into another's view. This single rule prevents a whole class of
cross-tenant bugs.

## Build order

Backend first, because the frontend depends on its contract:

1. Custom user model (email login, UUID for API responses, argon2 hashing).
2. SimpleJWT config (lifetimes, rotation, blacklist, claims).
3. Custom authenticator (cookie + Bearer, reject inactive/deleted users).
4. Cookie helpers and the login / register+verify / logout / refresh / me views.
5. Refresh hardening: rotation replay cascade and a user reload on the refresh
   path (SimpleJWT does not reload the user, so a stolen refresh otherwise mints
   access tokens forever after the account is disabled).
6. Revocation (per-JTI model + middleware + per-user watermark).
7. Rate limiting on the auth endpoints (IP-keyed, hard block, before the view).
8. DRF defaults, permission classes, throttles.
9. Security settings for life behind a proxy (proxy SSL header, HSTS, cookie
   flags, CSRF trusted origins, CORS with credentials).
10. RBAC permission classes and the tenant-scoping middleware.

Then the frontend:

1. Auth context: bootstrap the session by calling `/me/` (cookie-backed), seed
   the user from a local cache to avoid a logged-out flash, never store tokens in
   JavaScript.
2. A single-flight refresh interceptor: on 401, refresh once, queue concurrent
   requests behind that one refresh, retry, and bounce to sign-in on failure.
3. Route guards that fail closed (render a spinner until explicitly authorized).
4. Organization context: pick the active org, write the id in lockstep with the
   object, send it as the header on every request.
5. Cross-user state wipe on login (a different user on the same browser must not
   see the previous user's cached data), including the query cache on logout.

## Non-negotiables

If you take nothing else, take these. The full checklist is in the reference.

- Tokens are HTTPOnly cookies for browsers. Never put a JWT in localStorage or
  the URL.
- Rotate refresh tokens and blacklist the old one. Treat a reused refresh token
  as theft and revoke the user's sessions.
- Reload the user on the refresh path and reject if inactive or deleted.
- Hash with argon2. Rate-limit login, register, refresh, and password reset by
  IP, blocking before the view runs.
- Resolve the active tenant only from the explicit header. Never guess.
- Behind a proxy, set `SECURE_PROXY_SSL_HEADER` or HSTS and secure cookies
  silently break, and trust exactly one proxy hop for client IP.
