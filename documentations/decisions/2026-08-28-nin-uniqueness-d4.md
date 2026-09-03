---
date: 2026-08-28
status: accepted
tags: [security, kyc, backend, d4, ndpr]
---

# D4: NIN uniqueness via peppered HMAC digest

**Context.** One-account-per-NIN must be enforced, but QoreID returns masked
references (can't dedupe) and NDPR data-minimization means raw NINs must not be
stored.

**Decision.** At the moment verification succeeds, while the raw NIN is
transiently in memory, compute `HMAC-SHA256(pepper, NIN)` and store it in a
`nin_digest` column with a partial unique index (+ small `nin_digest_v` version
column). Pepper: 32-byte secret in SSM SecureString, injected as env at boot,
never in DB or code. Raw NIN never stored, never logged (scrub request logs).
Conflict → `blocked_duplicate` state with a support path; reveals NOTHING about
the existing account (no masked email, the check must not become an oracle); does
NOT consume one of the two fuzzy-match attempts. Unlink/transfer is an audited
admin action (lands with the admin portal).

**Why.** An NIN is 11 digits (~10^11 space): a plain hash is brute-forceable
overnight if the DB leaks; the pepper outside the DB means digests are worthless
without a second, separate compromise. HMAC is a boot-time env read + local CPU
op, zero scaling concern, same secret mechanics as SECRET_KEY. Local/test use a
different fixed pepper (deterministic tests, and a leaked dev DB says nothing
about prod).

**Accepted caveats.** Pre-existing verified users have no digest and can't be
backfilled (no raw NINs), so uniqueness is forward-looking; legacy dupes surface
on re-verification. Pepper rotation = forced re-verification, so it's
rotate-only-on-compromise, hence the version column. One person with tenant and
landlord roles uses one account (personas/orgs already live under one account).

**Rejected.** Encrypting raw NINs (decryptable store = standing breach
liability for data never needed again); provider-side dedupe (masked refs);
plain SHA-256 (brute-forceable).

**Revisit when.** QoreID exposes a stable dedupe token, or regulators change
what may be stored.

**Implementation (2026-08-29).** Landed dark in BE-heimly PR #103 and FE-heimly
PR #83, behind the seeded-disabled nin-uniqueness flag. Two choices made at
build time, within the accepted design: the FE collects first/last name at the
NIN step and saves an edit to the profile BEFORE the verify call (the backend
keeps matching against profile names; no new payload fields, and a failed save
aborts rather than burning an attempt), and blocked_duplicate returns HTTP 409
with a partial unique index as the race backstop (IntegrityError on the save
maps to the same response). The guard refusing an empty pepper outside DEBUG
also bites in pytest, since the Django test runner forces DEBUG=False; suites
must pin HEIMLY_NIN_PEPPER via the settings fixture. Enabling in prod requires
the HEIMLY_NIN_PEPPER SecureString in the task env first.

**Live (2026-09-01).** On for everyone. The flag is `enabled=True` globally and
the allowlist is empty; it was flipped only after the rollout below proved both
halves of the feature against real accounts.

The pepper is `/heimly-prod/app/nin-pepper`, a SecureString on `alias/aws/ssm`,
32 random bytes as 64 hex characters. It is created by hand and stays out of
Terraform on purpose. Terraform only publishes the ARN, the way it already does
for `db/password` and `app/SECRET_KEY`. If Terraform owned the value it would
sit in state and, worse, a plan could propose replacing it. That failure is
silent: digests written under a new pepper never match the old ones, so
duplicate detection stops working without erroring. The three backend
containers read it as an ECS secret, which wins over the `.env` written from
APP_ENV because `load_dotenv` is not called with `override`.

What we store per verified user is the 64-character digest, `nin_digest_v = 1`,
and nothing else derived from the number. What the uniqueness does, at the point
verification succeeds and before anything is written: compute the digest, look
for the same digest on any other account, and if one exists return
`blocked_duplicate` without consuming an attempt. The partial unique index
catches the race where two accounts get past the check together.

One thing we got wrong and fixed the same day. `kyc_provider_ref_id` was written
as `QOREID-NIN-616****19`, so five of the eleven digits sat in the clear. Nothing
read the field beyond audit, and the fragment undercut the control next to it:
with it, anyone holding both the database and the pepper faces 10^6 guesses to
recover a NIN from its digest instead of 10^11. It is now
`QOREID-{ID_TYPE}-{uuid4}`, and migration `account.0054` rewrote the 28 rows that
carried the old shape. That migration is irreversible by design, since there is
nothing to restore the digits from. A test reads the view source so putting the
mask back fails the suite rather than passing quietly. `kyc_metadata` still holds
`verified_name`, `date_of_birth` and `gender` from QoreID, which is a larger
footprint than what we just removed and deserves the same retention question.

Backup is the open edge. Deleting an SSM parameter is immediate and final: no
recycle bin, no recovery window, and AWS Backup does not cover Parameter Store.
An overwrite is recoverable from version history, a delete is not. So
`heimly-prod-secret-deletion-guard` now denies `ssm:DeleteParameter` on
`/heimly-prod/app/*` and `/heimly-prod/db/*` for both IAM users and both OIDC
roles, and an explicit deny beats AdministratorAccess. It does not bind the
account root, which only an SCP from the management account can reach. That
guard stops an accident inside the account; it does nothing if the account
itself is lost, so an offline copy of the pepper is still outstanding.

**Rollout.** Proved on two throwaway accounts rather than by reading the code.
The first verified and wrote the first digest in production. The second was
reset and re-verified against the same NIN and was refused with "NIN Already In
Use", without burning an attempt.
