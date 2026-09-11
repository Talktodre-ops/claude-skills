# Administrator accounts are separate from app accounts

Date: 2026-09-11. Status: accepted. Source: executive decision relayed by Dre.

## Decision

An email address is either an app account or an administrator account, never
both. An address that is or has ever been registered as a normal app user
cannot be granted an administrator role, and a Super Admin cannot override
that. Removing an administrator deactivates the administrator account and
releases the address, so the same email can then register as a normal app
user from scratch.

## How it is built

- `User.is_admin_account` marks administrator accounts. The Admins screen is
  the only path that creates one. A data migration grandfathers every active
  role holder at the time of the change; a read only management command lists
  any of those that also carry app footprint for a decision.
- Granting a role to an existing address that is not an administrator account
  is refused with "That email belongs to an app account. Administrators use a
  separate address."
- Removing an administrator (revoking the last active role) sets the account
  inactive and deleted, rewrites the email to a tombstone, keeps the original
  address in the audit row, and blacklists its tokens.
- Sign up refuses an address held by an active administrator account and never
  revives an administrator account the way it revives a soft deleted app
  account.
- Administrator accounts do not appear in the Users directory, cannot be
  campaign audience members, and cannot be message targets.

## Consequences

Support and Content admins need their own addresses. Existing mixed accounts
are reported, not silently changed. The web app signs out an administrator
account that signs in there and points it at the admin portal.

## Supersedes

Nothing. The phase plan's rule that Super Admin is seeded from `is_superuser`
and further roles are granted by name stands; this adds the separation.
