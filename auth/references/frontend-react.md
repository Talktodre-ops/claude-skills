# Frontend recipe: React / Next.js

Cookie-based auth, so the browser sends credentials automatically and JavaScript
never touches a token. The frontend stores only a user profile cache and the
active org id, both for UX, neither a credential. TanStack Query for server state.

Provider nesting matters: `QueryProvider` outermost, then `AuthProvider`, then
`OrganizationProvider`. Org context reads auth context, and both share one query
client.

## 1. Auth context

The state machine. Seed `user` synchronously from a local cache so the UI does not
flash logged-out on a hard refresh, then validate against the server in the
background. The cache is not authority; the HTTPOnly cookie is.

```tsx
// contexts/AuthContext.tsx
const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    if (typeof window === "undefined") return null;
    try { return JSON.parse(localStorage.getItem("user") || "null"); } catch { return null; }
  });
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Bootstrap the session from the cookie. GET /me/ authenticates via the cookie alone.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const fresh = await authService.getCurrentUser();   // GET /api/v1/auth/me/
        if (!cancelled) { setUser(fresh); localStorage.setItem("user", JSON.stringify(fresh)); }
      } catch (e: any) {
        // Only a 401/403 means logged out. Network or timeout keeps the cached user
        // so a flaky connection does not flash the UI to signed-out.
        if (!cancelled && /401|403|unauthorized/i.test(String(e?.message))) {
          setUser(null); localStorage.removeItem("user");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const login = async (creds: Credentials, nextUrl?: string) => {
    const res = await authService.login(creds);            // POST /auth/login/, sets cookies
    resetStaleStateIfUserChanged(res.user.id);             // see section 5
    setUser(res.user);
    localStorage.setItem("user", JSON.stringify(res.user));
    router.push(resolvePostLoginDestination(res.user, nextUrl));
  };

  const logout = async () => {
    try { await authService.logout(); } finally {          // POST /auth/logout/, clears cookies
      localStorage.removeItem("user");
      queryClient.clear();                                  // wipe in-memory query cache (see section 6)
      await clearLocalCaches();                             // IndexedDB, drafts, org keys
      setUser(null);
      router.push("/sign-in");
    }
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
```

Persona routing and a sanitized post-login destination. Only same-origin paths are
accepted, to prevent open redirects through `?next=`.

```tsx
function getDashboardRoute(user: User): string {
  switch (user.primary_role?.toLowerCase()) {
    case "tenant":   return "/find-properties";
    case "landlord": return "/dashboard/landlord";
    case "agent":    return "/dashboard/agent";
    case "admin":    return "/dashboard/admin";
    default:         return "/dashboard/landlord";
  }
}

function resolvePostLoginDestination(user: User, nextUrl?: string | null): string {
  const candidates = [nextUrl, sessionStorage.getItem("redirectAfterLogin")];
  for (const c of candidates) {
    if (typeof c === "string" && c.startsWith("/") && !c.startsWith("//")) {  // same-origin only
      sessionStorage.removeItem("redirectAfterLogin");
      return c;
    }
  }
  if (!user.onboarding_completed || !user.primary_role) return "/onboarding";
  return getDashboardRoute(user);
}
```

## 2. Single-flight refresh interceptor

The most important client pattern. On a 401, refresh once and queue concurrent
failing requests behind that single refresh, then replay them. Without the queue,
ten parallel requests that all 401 fire ten refresh calls (a stampede), and the
rotating refresh token races itself into a logout.

```ts
// lib/api.ts
import axios from "axios";

const api = axios.create({ baseURL: `${API_BASE}/api/v1/`, withCredentials: true });

api.interceptors.request.use((config) => {
  const orgId = localStorage.getItem("active_organization_id");
  if (orgId) config.headers["X-Organization-ID"] = orgId;
  return config;                                  // no Authorization header: the cookie carries auth
});

let isRefreshing = false;
let queue: Array<{ resolve: () => void; reject: (e: unknown) => void }> = [];
const flush = (err: unknown) => {
  queue.forEach((p) => (err ? p.reject(err) : p.resolve()));
  queue = [];
};

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config;
    const hadSession = !!localStorage.getItem("user");
    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(normalize(error));
    }
    if (isRefreshing) {
      // park behind the in-flight refresh, then replay
      return new Promise((resolve, reject) => queue.push({ resolve, reject }))
        .then(() => api(original));
    }
    original._retry = true;
    isRefreshing = true;
    try {
      await axios.post(`${API_BASE}/api/v1/auth/token/refresh/`, {}, { withCredentials: true });
      flush(null);
      return api(original);
    } catch (e) {
      flush(e);
      if (hadSession && !location.pathname.startsWith("/sign-in")) {
        localStorage.removeItem("user");
        location.href = "/sign-in?session=expired";
      }
      return Promise.reject(normalize(e));
    } finally {
      isRefreshing = false;
    }
  }
);
```

If you also use native `fetch` for some calls, give it the same single-flight
guard. Do not ship two transports with divergent refresh logic; pick one model.
Every authed request needs `withCredentials: true` (axios) or
`credentials: "include"` (fetch), or the browser will not send the cookies.

Type your domain errors so callers can branch on them instead of string-matching:

```ts
export class PlanLimitError extends Error {
  constructor(public code: string, public resource: string, public upgradeUrl: string) {
    super(`Plan limit reached: ${resource}`);
  }
  static is(e: unknown): e is PlanLimitError { return e instanceof PlanLimitError; }
}
```

## 3. Token storage

Tokens live in HTTPOnly cookies set by the backend. The frontend cannot and should
not read them. A "save tokens" function is a deliberate no-op; presence checks read
the user cache, not a token.

In localStorage, keep only UX state: the `user` profile cache (anti-flash and a
"had a session" signal for the interceptor), `active_organization` and
`active_organization_id`, and any per-user drafts. None of it is a credential. A
tampered cache is corrected on the next `/me/`.

The security tradeoff of cookies is CSRF, not XSS. HTTPOnly defeats XSS token theft.
You handle CSRF with SameSite plus the cross-origin CORS setup on the backend.

## 4. Route guards (fail closed)

A guard renders a spinner until it can prove the user is allowed. It never renders
protected children on an unknown state.

```tsx
// components/RoleGuard.tsx
export function RoleGuard({ allowedRoles, children }: Props) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { activeOrganization, isLoading: orgLoading } = useOrganization();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (isLoading || orgLoading) return;                  // wait for both auth and org
    if (!isAuthenticated || !user) {
      sessionStorage.setItem("redirectAfterLogin", pathname);   // handshake with resolvePostLoginDestination
      router.push("/sign-in");
      return;
    }
    // Effective role follows the active org type, then falls back to the account role.
    const effective = ORG_TYPE_TO_ROLE[activeOrganization?.org_type ?? ""] ?? user.primary_role;
    if (!allowedRoles.includes(effective)) router.push(getDashboardRoute(user));
  }, [isLoading, orgLoading, isAuthenticated, user, activeOrganization]);

  const authorized = !isLoading && !orgLoading && isAuthenticated &&
    allowedRoles.includes(ORG_TYPE_TO_ROLE[activeOrganization?.org_type ?? ""] ?? user?.primary_role);
  if (!authorized) return <FullScreenSpinner />;
  return <>{children}</>;
}
```

Gate the dashboard at the layout level, not per page. Layout components (sidebars,
providers) fire queries on mount and must not run pre-auth. Hold the whole subtree
on a spinner until `!isLoading && user`, and on logout the providers and children
must mount and unmount together, or a child calling a context mid-teardown throws.

This is UX gating only. Real enforcement is the backend on every request. The guard
makes the UI honest; it is not the security boundary.

## 5. Cross-user state wipe

A different user logging in on the same browser (a shared machine, an invite flow)
must not see the previous user's cached data. Compare the incoming id to the cached
id; same user is a no-op, different user wipes the per-user caches.

```ts
function resetStaleStateIfUserChanged(incomingId: string) {
  const cached = JSON.parse(localStorage.getItem("user") || "null");
  if (cached?.id === incomingId) return;                  // same user: keep caches
  localStorage.removeItem("active_organization");
  localStorage.removeItem("active_organization_id");
  localStorage.removeItem("organizations_list_cache");
  for (const k of Object.keys(localStorage)) {            // prefix-scan: localStorage has no filter
    if (k.startsWith("app:draft:")) localStorage.removeItem(k);
  }
  clearIndexedDBCaches();                                  // chat, offline data, etc.
}
```

The wipe must cover every store that holds user-scoped data: localStorage,
IndexedDB, and the in-memory TanStack cache (call `queryClient.clear()` on logout).
Missing one of these is how "I logged in but still see the last person's data"
bugs happen.

## 6. TanStack Query

Keep auth out of the query cache. The user lives in auth context state plus the
local cache because guards and the anti-flash path need it synchronously at mount,
which a query cannot guarantee. Everything else is query state.

```tsx
// provider/QueryProvider.tsx
const [client] = useState(() => new QueryClient({
  defaultOptions: { queries: {
    retry: 2, staleTime: 60_000, gcTime: 15 * 60_000, refetchOnWindowFocus: false,
  }},
}));
```

Scope per-org query keys by the org id so each org caches independently:

```ts
const SUBSCRIPTION_KEY = ["subscription", "current"];
const usageKey = (orgId?: string) => ["subscription", "usage", orgId ?? "all"];
```

Invalidation rules:

- After login: prefetch and warm role-aware caches.
- On org switch: simplest correct option is a full page reload, which re-runs every
  query under the new `X-Organization-ID`. If you want a soft switch instead,
  invalidate every org-scoped key explicitly, which is easy to get wrong.
- On logout: `queryClient.clear()`. Do not rely on navigation alone; the in-memory
  cache survives SPA navigation and would leak to the next user.

## 7. Sign-in form and flow

Two safeguards that are easy to omit:

Give the form a real `method="post"` action even though `onSubmit` calls
`preventDefault`. If hydration is slow or JS errors before the handler attaches, a
default GET submit leaks `?email=&password=` into the URL, history, referer, and
server logs. The attribute is a defense, not decoration.

```tsx
<form method="post" action="?" onSubmit={handleSubmit}>
```

Read `?next=` and pass it to `login`, where `resolvePostLoginDestination` sanitizes
it to a same-origin path. Persist an `?invitation=<token>` to
`sessionStorage.redirectAfterLogin` so post-login routing returns the user to the
invite. For social login, the backend sets cookies on the OAuth redirect and the
auth context's `/me/` bootstrap picks them up; no token extraction from the URL.

## 8. Idle logout

Arm an inactivity timer only while authenticated. Reset it on user activity
(mouse, key, touch, scroll), and on timeout do a hard navigation
(`location.replace("/sign-in")`) rather than a soft router push, so heavy client
state (websockets, suspense boundaries, background timers) is fully torn down.
