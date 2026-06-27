# Backend: resolution, scoping, RLS

Django and DRF. Generalized names. The tenant is an `Organization`; a user belongs
to many.

## 1. Tenant resolution (the fail-safe)

One function, idempotent, called wherever the active tenant is needed. It reads the
header, verifies membership three ways, and leaves the tenant unset on any
ambiguity.

```python
# tenancy/scoping.py
def ensure_request_organization(request):
    if getattr(request, "organization", None) is not None:
        return                                  # idempotent: already resolved this request
    user = request.user
    if not user or not user.is_authenticated:
        return
    org_id = request.headers.get("X-Organization-ID")
    if not org_id:
        return                                  # no header: self-scoped, do not guess
    try:
        org = Organization.objects.get(uuid=org_id, is_deleted=False)
    except Organization.DoesNotExist:
        return
    belongs = (
        org.owner_id == user.id
        or org.members.filter(id=user.id).exists()
        or UserRole.objects.filter(user=user, organization=org, is_deactivated=False).exists()
    )
    if belongs:
        request.organization = org
    # else: leave it unset. A foreign org id resolves to None, never to a different org.
```

Three membership signals (ownership, the membership table, an active role) so a
legitimate header is never rejected over a missing row on a legacy org. A foreign
org id still resolves to None.

Why a standalone function, not just middleware. For token or cookie auth, the user
is still anonymous when middleware `process_view` runs, because DRF authentication
happens later inside the view's dispatch. So the middleware version is effectively
a no-op for the API, and the real resolution happens by calling this function from
inside the view, the permission class, or the queryset, after `request.user` is
populated. Keep it idempotent so calling it from several places is free.

## 2. Queryset scoping (the boundary)

Scope every list query by the resolved tenant. The pattern that handles a
multi-persona user (someone who is both a tenant and a landlord) without leaking:
the active org is the scope, and the user's own personal rows are unioned in only
when it is safe.

```python
# tenancy/views.py
def get_queryset(self):
    ensure_request_organization(self.request)
    active_org = getattr(self.request, "organization", None)
    user = self.request.user

    is_personal_view = bool(active_org and active_org.org_type == "PERSONAL")

    # Own personal rows: include in the personal view, when no org resolved
    # (fail-safe self-scope), or on a detail action; never in a business LIST.
    show_own = is_personal_view or active_org is None or self.action != "list"
    q = Q(owner_user=user) if show_own else Q(pk__in=[])

    if not is_personal_view and active_org is not None:
        q |= Q(organization=active_org)         # the active business org only

    return Lease.objects.filter(q)
```

Two failure modes this closes. A personal row bleeding into a business list (it is
excluded from `list`). And a 404 regression where a dual-persona user could not
open their own personal row from a business context (so `Q(owner_user=user)` is
re-allowed when the action is not `list`). Note what it does not do: it never
unions "all orgs the user owns." The active org is the scope. The bug it replaced
computed the active org and then never used it to narrow, which mixed personas.

## 3. Permission classes (authorize the action)

Resolve roles scoped to the active org, and call the resolver first so you never
authorize against a blank or stale org.

```python
# tenancy/permissions.py
class IsOrgMember(BasePermission):
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        ensure_request_organization(request)
        org = getattr(request, "organization", None)
        if not org:
            return False                         # no org context: deny
        if request.user.is_staff or request.user.is_superuser:
            return True
        roles = get_roles(request.user, org)     # roles scoped to THIS org
        return any(r in roles for r in ("OWNER", "ADMIN", "MEMBER"))
```

For member-management endpoints, read the org from the URL kwarg instead of the
header, so the check is against the org being managed regardless of which org is
currently active.

## 4. Row-level security (defense in depth)

Postgres policies that contain an application bug. Worth doing, but only if you do
the load-bearing parts that most guides skip. Four steps.

Step one, the policies. Enable and force RLS on each tenant table, then a policy
that allows a row when the session has no user set (system or migration access), or
the row is the user's own, or the row's org is one the user belongs to.

```sql
ALTER TABLE app_lease ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_lease FORCE ROW LEVEL SECURITY;   -- FORCE so the table owner is bound too
CREATE POLICY lease_isolation ON app_lease
USING (
  COALESCE(current_setting('app.current_user_id', true), '') = ''        -- (a) system bypass
  OR tenant_id = NULLIF(current_setting('app.current_user_id', true), '')::bigint  -- (b) own row
  OR organization_id IN (                                                 -- (c) org member
    SELECT organization_id FROM app_user_organization
    WHERE user_id = NULLIF(current_setting('app.current_user_id', true), '')::bigint
      AND is_deleted = false
  )
);
```

The `NULLIF(..., '')::bigint` matters: Postgres does not guarantee that the OR
short-circuits, so a bare `''::bigint` throws `invalid input syntax for type
bigint` on the bypass path. `NULLIF` turns the empty string into NULL, and
`col = NULL` is false (no error). Index the membership lookup with a partial index
on `(user_id, organization_id) WHERE is_deleted = false`.

Step two, the role switch, which is what makes RLS actually apply. A Postgres role
with `BYPASSRLS` ignores every policy. The default login role often has it (it runs
migrations and admin). So create a second role with `NOBYPASSRLS`, grant it DML,
and switch to it on every new connection, except during migrations.

```python
# on each new DB connection (a connection_created signal handler)
def _on_connection_created(sender, connection, **kwargs):
    if _is_migration_command():                  # detect via sys.argv: migrate, makemigrations
        return                                   # DDL must run as the owner
    with connection.cursor() as c:
        c.execute("SELECT current_user")
        if c.fetchone()[0] != "app_query_role":
            c.execute("SET ROLE app_query_role") # NOBYPASSRLS: policies now apply
```

Without this, RLS is silently inert and you will believe you are isolated when you
are not. On a managed database where the login role is already `NOBYPASSRLS`, the
switch is a harmless no-op.

Step three, set the variable per request, and clear it on both sides. After
authentication, set the session variable to the user's id. Critically, clear it
before and after every request, because a pooled connection (any nonzero
`CONN_MAX_AGE`) carries the value from user A's request into user B's.

```python
def set_rls_user(pk):
    with connection.cursor() as c:
        c.execute("SELECT set_config('app.current_user_id', %s, false)", [str(pk)])  # session scope

def clear_rls_user():
    if getattr(connection, "connection", None) is None:
        return                                   # do not open a connection just to clear
    with connection.cursor() as c:
        c.execute("SELECT set_config('app.current_user_id', '', false)")

class RLSMiddleware:
    def __call__(self, request):
        clear_rls_user()                         # wipe value left on a reused connection
        try:
            return self.get_response(request)
        finally:
            clear_rls_user()
```

Set the variable from your authenticator (for token auth) and from a post-auth
middleware (for session auth). Skip it for superusers and the admin path so they
keep full access.

Step four, know what not to cover. Do not put RLS on the membership table, the role
table, or the org table: every policy's subquery reads them, so a policy on them
evaluates recursively. Skip tables with mixed public and private rows (a
marketplace listing table), where a simple org policy breaks legitimate
cross-tenant public reads; handle those in the app layer. Skip pure lookup tables
and system tables.

The honest caveat. RLS here is defense in depth against an application bug, not a
hard boundary. Background workers and migrations run under the same role with the
variable unset, which clause (a) treats as full access. A compromised worker is not
contained by RLS. The hard boundary stays the queryset scoping in step two.

## 5. The isolation test

Drive the real resolver and the real querysets (not HTTP), with a fake request that
carries the header and a case-insensitive `headers.get`, and deliberately do not
pre-set the org so the resolver does its real work.

Set up one user who owns three orgs of different types, plus a second user who owns
a resource the first user consumes (so the first user also has personal rows whose
org is the second user's). Then assert:

- Resolution: header for org L resolves to L, for C to C, for the personal org to
  it; no header resolves to None; a foreign org's header (one the user does not
  belong to) resolves to None.
- Lists: each context returns only its own rows; the business list does not contain
  the user's personal row; no header falls back to the user's own rows only.
- Detail: the user can still open their own personal row from a business context
  (no 404 regression).
- Cross-tenant: org L's rows never appear in org C's list and vice versa.

In one line: it proves org A cannot read org B through any resource, and that the
resolver fails safe rather than guessing.
