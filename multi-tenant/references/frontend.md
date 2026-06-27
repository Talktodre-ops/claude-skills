# Frontend: the org context and the lockstep

The frontend feeds layer 1 of the isolation model by emitting the
`X-Organization-ID` header. The whole backend fail-safe depends on the frontend
either sending the right org or sending nothing. The danger is sending an
inconsistent state: the UI showing one persona while the header carries another, or
the UI showing a persona while the header is absent. One invariant prevents that.

## The lockstep invariant

The active org lives in two local-storage keys: the object (`active_organization`,
which drives the UI persona) and the bare id (`active_organization_id`, which the
request layer reads to set the header). These two must never diverge. Every place
that sets one sets the other, including the synchronous initializer.

```ts
// OrganizationContext.tsx
const [activeOrg, setActiveOrgState] = useState<Org | null>(() => {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("active_organization");
  if (!raw) return null;
  const org = JSON.parse(raw);
  localStorage.setItem("active_organization_id", org.id);  // rewrite the id in lockstep at init
  return org;
});

function setActiveOrg(org: Org) {
  setActiveOrgState(org);
  localStorage.setItem("active_organization", JSON.stringify(org));
  localStorage.setItem("active_organization_id", org.id);  // never set one without the other
}
```

Why the initializer rewrites the id. If the object key is present but the id key is
missing (a half-written state from an older build, a cleared key), requests go out
with no header, the backend resolver self-scopes, and a personal row can surface in
a business list. Rewriting the id from the object at init closes that gap before the
first request fires. The object drives the persona, the id drives the header, and a
mismatch reintroduces exactly the leak the backend works to prevent.

## Choosing the active org

When there is no active org yet, prefer an owned org over a team membership, then
match the org type to the user's role. This is why a user who is an agent but also a
team member in someone else's landlord org lands on their own agent dashboard, not
the landlord's.

```ts
const ROLE_ORG_TYPES: Record<string, string[]> = {
  AGENT: ["INDEPENDENT_AGENT", "REAL_ESTATE_COMPANY", "AGENT_AGENCY"],
  LANDLORD: ["INDIVIDUAL_LANDLORD"],
  TENANT: ["PERSONAL"],
};

export function pickBestOrg(orgs: Org[], primaryRole?: string): Org | undefined {
  const owned = orgs.filter((o) => o.is_owner);
  if (owned.length === 0) return orgs[0];               // only team memberships
  const wanted = primaryRole ? ROLE_ORG_TYPES[primaryRole.toUpperCase()] ?? [] : [];
  return owned.find((o) => wanted.includes(o.org_type ?? "")) ?? owned[0];
}
```

## Injecting the header

Both transports read the id key and attach the header, and both omit it entirely
when no id is cached. That omission is deliberate: it is the exact input the backend
resolver treats as "no active org, self-scope," which closes the loop.

```ts
// in the axios request interceptor and in the fetch wrapper, identically:
const orgId = localStorage.getItem("active_organization_id");
if (orgId) config.headers["X-Organization-ID"] = orgId;
// auth is via HTTPOnly cookies, so there is no Authorization header; the org header
// is the only app-set header here.
```

Keep the two transports identical. If one wrapper forgets the header, the calls it
makes go out unscoped while the rest are scoped, which is a confusing partial leak.

## Switching orgs: reload, do not patch

On a switch, persist both keys and then do a full reload, so every in-flight query
and every cache re-issues under the new header. A soft switch that tries to
invalidate the right queries is easy to get wrong and leaves stale,
previous-persona data in the cache.

```ts
async function switchOrganization(orgId: string) {
  const org = await api.post(`/organizations/${orgId}/switch/`).then((r) => r.data);
  setActiveOrg(org);                 // writes both keys
  window.location.reload();          // every query refetches under the new X-Organization-ID
}
```

## Self-heal on focus

Re-fetch the org list on window focus and visibility change, so a membership change
made elsewhere (an admin removing the user from a team org, a role change) takes
effect without a manual reload, and the active-org pointer self-heals if the cached
org is gone.

```ts
useEffect(() => {
  const resync = () => { if (isAuthenticated) fetchOrganizations(); };
  window.addEventListener("focus", resync);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") resync();
  });
  return () => { window.removeEventListener("focus", resync); /* ... */ };
}, [isAuthenticated]);
```

## The cross-user wipe (shared browser)

A different user signing in on the same browser must not inherit the previous user's
org state. Compare the incoming user id to the cached one; same user is a no-op, a
different user wipes the org keys and any other per-user cache.

```ts
function resetStaleStateIfUserChanged(incomingUserId: string) {
  const cached = JSON.parse(localStorage.getItem("user") || "null");
  if (cached?.id === incomingUserId) return;           // same user: keep state
  localStorage.removeItem("active_organization");
  localStorage.removeItem("active_organization_id");
  localStorage.removeItem("organizations_list_cache");
  for (const k of Object.keys(localStorage)) {
    if (k.startsWith("app:draft:")) localStorage.removeItem(k);
  }
  clearIndexedDBCaches();                              // chat and other offline stores
}
```

The bug this prevents: user A invites user B, hands B the same browser, B signs up
through the invite link. B's cookie replaces A's and the user becomes B, but
`active_organization` and the other caches are still A's, so A's identity and org
flash in B's UI until the org fetch reconciles. No server data is disclosed (the
backend still scopes by B's cookie), but it reads as a session leak in QA. Call the
wipe from both login and any user-refresh path, and clear the same caches on logout.
On de-authentication, clear all three org keys too.
