# Security checklist, known gaps, and adaptation

## Ship checklist

Run through this before calling auth done. Each line is a real failure mode, not a
formality.

Tokens and transport:

- [ ] Browser tokens are HTTPOnly cookies. No JWT in localStorage, sessionStorage,
      or any URL.
- [ ] Access lifetime is short (about 30 minutes). Refresh is longer (about 7 days).
- [ ] Refresh rotates on every use, and the old refresh is blacklisted.
- [ ] A reused (already blacklisted) refresh triggers cascade revocation of that
      user's sessions.
- [ ] The refresh endpoint reloads the user and refuses if inactive or deleted.
- [ ] Prod cookies are SameSite=None plus Secure for cross-origin, or SameSite=Lax
      for same-origin. Dev matches its origin setup.

Identity and revocation:

- [ ] Passwords hashed with argon2. Password strength validated on register and
      change.
- [ ] A per-token (JTI) blacklist exists for logout and targeted kills.
- [ ] A per-user watermark exists for "log out everywhere," set with a plus-one-
      second offset because iat is second-resolution.
- [ ] Revocation lookups are not cached.
- [ ] The integer PK is kept out of API URLs and bodies (use a UUID). Note it is
      still readable in the JWT payload; do not treat it as secret.

Access control and tenancy:

- [ ] Roles are read from the DB per request, not trusted from the JWT.
- [ ] Permission classes are not the data boundary. Querysets are also scoped by
      the active org or owner.
- [ ] The active tenant resolves only from the explicit header, verified against
      membership, and is left unset (self-scoped) otherwise. Never guessed.
- [ ] A smoke test asserts org A cannot read org B's data.

Rate limiting and abuse:

- [ ] Login, register, refresh, forgot-password, reset-password are IP-rate-limited
      and block before the view runs.
- [ ] Email verification has a rate limit and an attempt cap (see gaps below).
- [ ] DRF throttles cover general API capacity. NUM_PROXIES is set if behind a
      proxy.

Proxy and headers:

- [ ] SECURE_PROXY_SSL_HEADER is set, or HSTS and secure cookies silently fail.
- [ ] SECURE_SSL_REDIRECT is False if the proxy already does HTTP to HTTPS.
- [ ] HSTS, nosniff, and X-Frame-Options DENY are on.
- [ ] CORS allows credentials and explicitly allows the tenant header. CSRF trusted
      origins include every frontend origin (apex and www if both call the API).

Frontend:

- [ ] One authed-fetch implementation with a single-flight refresh. No stampede.
- [ ] Logout clears localStorage, IndexedDB, and the in-memory query cache.
- [ ] A different user on the same browser wipes per-user caches on login.
- [ ] Guards fail closed and gate at the layout level.
- [ ] The sign-in form has method="post" as a pre-hydration safeguard, and `?next=`
      is sanitized to a same-origin path.

## Known gaps to fix (do not copy these blindly)

The source system is strong but has real weaknesses the agents found. A better
version fixes them.

Email verification is brute-forceable. A 6-digit numeric code (a space of one
million) matched by exact lookup with no rate limit and no per-code attempt counter
can be brute-forced for a known email. Fix: rate-limit verify by IP and by email,
cap attempts per code (lock after 5), and expire aggressively. Make resend-code
rate-limited and return a generic response regardless of account state, because a
404 "user not found" versus a 400 "already verified" is an account-enumeration
oracle, and unrestricted resend is an email-spam vector.

Token-reuse telemetry skips cookie sessions. If you add a reuse-detection layer
that fingerprints per-JTI usage, read the token from both the Authorization header
and the cookie. Reading only the header means browser sessions (the majority) are
invisible to it. Also keep its cache TTL aligned with the real access lifetime, not
a stale assumption.

HS256 ties the JWT to your one secret. With HS256 and SIGNING_KEY equal to
SECRET_KEY, the key that signs tokens also signs everything else Django signs, and a
leak lets an attacker forge tokens. For a higher bar, move to RS256: sign with a
private key dedicated to JWTs, verify with the public key, and rotate independently
of SECRET_KEY. See adaptation below.

Two password columns is a footgun. If the model history left a legacy
`password_hash` column next to the inherited `password`, any code that restricts
`update_fields` to the wrong one silently drops the write, which already bit a
change-password path. Migrate the data and drop the dead column.

JWT claims can drift from reality. If you enrich tokens with org context in a custom
obtain serializer but your actual login path uses `RefreshToken.for_user` (which
does not run that serializer), the claims are absent on the primary path. Either
wire the serializer into the real login path or, better, do not read authorization
from JWT claims at all. Read it from the DB per request and let the header carry the
active tenant.

RLS is defense in depth, not a boundary. Postgres row-level security keyed on a
session variable is a good second layer, but if background workers share the same DB
role they bypass it, so it is not your primary isolation. Keep queryset scoping as
the real boundary.

No second factor. A `two_factor_enabled` flag with no enforcement is just a column.
If you advertise 2FA, enforce it: see adaptation.

## Adapting the blueprint

Single-tenant app. Drop the entire tenant layer: no `X-Organization-ID`, no
`ensure_request_organization`, no OrganizationContext, no per-org query keys. Keep
everything else. Authorization collapses to user roles plus ownership checks.

Mobile or API-only client. Drop cookies and the cookie path in the authenticator.
Use Bearer only, store the refresh token in the platform's secure storage (Keychain,
Keystore), and keep rotation and revocation unchanged. The single-flight refresh
pattern still applies in the mobile HTTP client.

Same-origin browser app (frontend and API on one origin). Use SameSite=Lax cookies,
skip the cross-origin CORS-credentials setup, and you can lean on Django's CSRF
protection directly. Simpler, but you lose the option to host the SPA on a separate
domain or CDN.

RS256 instead of HS256. Generate an RSA keypair dedicated to JWTs. Set
`ALGORITHM = "RS256"`, `SIGNING_KEY` to the private key (from a secret store, not
SECRET_KEY), and `VERIFYING_KEY` to the public key. Resource servers then verify
with only the public key and never hold the signing key, which is what lets you
split auth from the services that consume tokens.

Add TOTP 2FA. After password auth succeeds, if the user has 2FA enabled, do not mint
the final token pair yet. Issue a short-lived "pending 2FA" token, require a valid
TOTP code on a second endpoint, then mint the real pair. Store the TOTP secret
encrypted, offer recovery codes, and rate-limit the verify step hard.

Stateless-only (no DB revocation). If you cannot afford a per-request DB lookup, you
can drop the revocation middleware and rely on short access lifetimes alone, but you
lose immediate logout and "log out everywhere." This is a real tradeoff: shorter
tokens reduce the exposure window but increase refresh traffic. Do not pretend you
have revocation if you remove it.

## The one-paragraph version

Identity is a short-lived signed token, validated statelessly. Browsers carry it in
HTTPOnly cookies, other clients in a Bearer header, and one authenticator handles
both. Sessions extend through rotating refresh tokens, and a reused refresh is
treated as theft. Two cheap primitives turn a stateless token off early: a per-token
blacklist and a per-user watermark. Authorization is never in the token; roles come
from the DB per request, and the active tenant comes from one header that is
verified and never guessed. Around all of it sit IP rate limits on the auth
endpoints, argon2 hashing, and the proxy-aware header and cookie posture that keeps
HSTS and secure cookies from silently failing.
