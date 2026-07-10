# Security testing

Security is not a phase at the end; it is a set of properties you assert like any
other. These are the checks that keep a multi-tenant SaaS safe. Run the ones that
apply to what you changed on every commit, and the full pass before a release and on
anything touching auth, uploads, or tenant scoping.

## Authorization and tenant isolation (the top priority)

The single most valuable security test in a shared-database SaaS: prove one tenant
cannot reach another's data. Seed org A and org B, then assert A gets a 404 or 403
(prefer 404, so the endpoint is not an existence oracle) on every id-addressed route
for a B-owned object, across GET, PUT, and DELETE.

```python
# A authenticated as its own user, probing B's resources
for method, path in [("GET", f"/templates/{B_tpl}"), ("PUT", f"/templates/{B_tpl}"),
                     ("DELETE", f"/templates/{B_tpl}"), ("GET", f"/results/{B_session}")]:
    r = await client.request(method, API + path, headers=A_auth)
    assert r.status_code in (403, 404), f"leak: {method} {path} -> {r.status_code}"
# anonymous probes: a paid or sensitive route with no creds is 401, not 200
assert (await client.post(f"{API}/scoring/score/{B_session}")).status_code == 401
```

Make this a standing regression gate that runs on every change, even unrelated ones.
Cross-tenant leaks hide in innocent-looking diffs (a cache key that drops the tenant,
a new endpoint that forgets the scope filter). Also check role gates: a member is
403 on an admin-only action; the last admin cannot be removed or demoted.

## Authentication

- **Password policy** is enforced on register, reset, and change: length, and at
  least one upper, lower, digit, and symbol; reject the email local-part and a common
  denylist. Assert each weak variant is rejected with the specific reason.
- **Rate limiting and lockout** on login, register, reset, and verify, keyed by IP
  (and by account for lockout). Assert the Nth rapid attempt is throttled.
- **Session revocation** works: after a logout, a password change, a role change, or
  a member removal, the old session or token is dead on the next request.
- **Verification** is enforced at login if the product requires it, and existing
  users are grandfathered so the rollout does not lock anyone out.
- Tokens live in HTTPOnly cookies for browsers, never in localStorage or a URL.

## Input validation and injection

- Parameterized queries only; never string-format user input into SQL. A test that
  submits `'; DROP TABLE ...` and asserts a clean 400 or a literal match documents it.
- Escape or framework-encode all rendered user content; assert a `<script>` payload
  is neutralized, not reflected.
- Validate and allowlist any URL you fetch server-side (SSRF): reject internal hosts
  and non-HTTP schemes.
- Reject path traversal (`../`) in any filename or key derived from user input.

## File uploads (a common hole)

Accept only what you mean to, checked three ways, or a renamed executable gets in:

- **Content-type** in an allowlist (for an avatar: `image/png`, `image/jpeg`,
  `image/webp`).
- **Extension** in an allowlist.
- **Magic bytes** actually match an image (PNG `\x89PNG`, JPEG `\xff\xd8\xff`, WebP
  `RIFF....WEBP`), so a spoofed content-type on real non-image bytes is rejected.
- **Size cap** enforced before storage.

```python
# a .png name + image/png type but junk bytes must be rejected by the magic-byte check
r = await client.post(url, headers=auth, files={"file": ("evil.png", b"MZ\x90 not an image", "image/png")})
assert r.status_code == 400
```

## Secrets and data exposure

- No secrets in code, tests, logs, fixtures, or error messages. Load from env and
  reference a committed `.env.example`. A committed `.env` is a finding.
- No PII or tokens in URLs, query strings, or referrers.
- Error responses do not leak stack traces or internals outside true local dev.

## Transport and browser posture

- CSRF: SameSite cookies plus, on unsafe methods with a session cookie present, an
  allowlisted `Origin` check. Assert a cross-origin POST is refused.
- CORS is credentialed only for the app's own origins, not `*`.
- Security headers present: HSTS, a real CSP, `X-Content-Type-Options: nosniff`,
  and frame-deny. Behind a proxy, confirm the forwarded-proto handling so secure
  cookies and HSTS are not silently dropped.

## Dependencies and static analysis

- Run a dependency audit in CI (`npm audit`, `pip-audit` or equivalent) and fail on
  high-severity known vulnerabilities.
- Run a static analyzer (a linter security plugin, `bandit`, `semgrep`) on the diff.
- Pin and review new dependencies; a supply-chain risk is a real risk.

## The mindset

Test the negative space. For every "the user can do X" test, write "someone who
should not, cannot": the other tenant, the wrong role, the anonymous caller, the
expired token, the oversized or spoofed file. That negative-space coverage is the
difference between an app that demos well and one that is safe to ship.
