# Backend recipe: Django + DRF + SimpleJWT

Real APIs, generalized names. Rename `accounts`, `User`, cookie names, and paths
to the target project. Assumes `djangorestframework-simplejwt` with its
`token_blacklist` app installed and migrated.

## 1. User model

Email login, UUID for API responses (never expose the integer PK in URLs),
argon2 hashing. The integer PK is still the JWT subject, so keep it off the wire.

```python
# accounts/models.py
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
from django.db import models
import uuid

class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra):
        if not email:
            raise ValueError("Email is required")
        user = self.model(email=self.normalize_email(email), **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra):
        extra.setdefault("is_staff", True)
        extra.setdefault("is_superuser", True)
        return self.create_user(email, password, **extra)

class User(AbstractBaseUser, PermissionsMixin):
    uuid = models.UUIDField(default=uuid.uuid4, unique=True, editable=False, db_index=True)
    email = models.EmailField(unique=True)
    first_name = models.CharField(max_length=150)
    last_name = models.CharField(max_length=150)

    is_active = models.BooleanField(default=True)        # gate: inactive cannot authenticate
    is_verified_email = models.BooleanField(default=False)
    is_staff = models.BooleanField(default=False)
    is_deleted = models.BooleanField(default=False)      # soft delete
    deleted_at = models.DateTimeField(null=True, blank=True)

    # Bulk revocation watermark. Any token with iat <= this is treated as revoked.
    tokens_invalidated_after = models.DateTimeField(null=True, blank=True, db_index=True)

    # Persona hint set at onboarding. Authoritative roles live in UserRole (section 10).
    primary_role = models.CharField(max_length=15, null=True, blank=True)

    objects = UserManager()
    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["first_name", "last_name"]
```

```python
# settings.py
PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.Argon2PasswordHasher",
    "django.contrib.auth.hashers.PBKDF2PasswordHasher",   # fallbacks verify legacy hashes
    "django.contrib.auth.hashers.BCryptSHA256PasswordHasher",
]
AUTH_USER_MODEL = "accounts.User"
```

Add custom `AUTH_PASSWORD_VALIDATORS` (min length, upper/lower/digit/special,
common-password denylist, no-email-in-password) for registration and change
flows. Keep the validators in one module and call them from the views.

## 2. SimpleJWT config

```python
# settings.py
from datetime import timedelta

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=30),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,        # every refresh issues a new refresh token
    "BLACKLIST_AFTER_ROTATION": True,     # and blacklists the old one (replay detection)
    "UPDATE_LAST_LOGIN": True,
    "ALGORITHM": "HS256",                 # symmetric; SIGNING_KEY = SECRET_KEY
    "SIGNING_KEY": SECRET_KEY,            # see security-checklist for the RS256 upgrade
    "AUTH_HEADER_TYPES": ("Bearer",),
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
    "JTI_CLAIM": "jti",                   # required for per-token revocation
}
```

Keep the token carrying identity, not authorization. Do not stuff org roles into
the JWT and trust them for access decisions. Roles change; a 30-minute token does
not. Read roles from the DB per request (section 10).

## 3. Custom authenticator (cookie + Bearer)

The header path is strict (raises on a bad token). The cookie path is graceful
(returns None on failure) so a browser with an expired access cookie falls through
to anonymous and can silently refresh. It also rejects inactive and soft-deleted
users, which the parent class does not.

```python
# accounts/authentication.py
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import AuthenticationFailed

ACCESS_COOKIE = "access_token"

class CookieOrBearerJWTAuthentication(JWTAuthentication):
    def get_user(self, validated_token):
        user = super().get_user(validated_token)
        if not user.is_active or getattr(user, "is_deleted", False):
            raise AuthenticationFailed("Account is inactive or has been deleted.")
        return user

    def authenticate(self, request):
        header = self.get_header(request)
        if header is not None:                         # 1. Bearer: strict, raises on error
            raw = self.get_raw_token(header)
            if raw is not None:
                token = self.get_validated_token(raw)
                return self.get_user(token), token

        cookie = request.COOKIES.get(ACCESS_COOKIE)    # 2. cookie: graceful
        if not cookie:
            return None
        raw = cookie.encode() if isinstance(cookie, str) else cookie
        try:
            token = self.get_validated_token(raw)
            return self.get_user(token), token
        except AuthenticationFailed:
            return None                                # browser refreshes and retries
```

## 4. Cookie helpers and settings

HTTPOnly always. In dev (same origin), SameSite=Lax and Secure=False. In prod
(SPA and API on different subdomains), SameSite=None and Secure=True, which the
browser requires for cross-site cookies. Drive it from settings so the views stay
environment-agnostic.

```python
# accounts/cookies.py
from django.conf import settings

ACCESS_COOKIE, REFRESH_COOKIE = "access_token", "refresh_token"
ACCESS_MAX_AGE, REFRESH_MAX_AGE = 30 * 60, 7 * 24 * 60 * 60   # mirror the JWT lifetimes

def set_auth_cookies(response, access, refresh):
    samesite = getattr(settings, "AUTH_COOKIE_SAMESITE", "Lax")
    secure = getattr(settings, "AUTH_COOKIE_SECURE", not settings.DEBUG)
    if samesite == "None":
        secure = True
    common = dict(httponly=True, secure=secure, samesite=samesite, path="/")
    response.set_cookie(ACCESS_COOKIE, access, max_age=ACCESS_MAX_AGE, **common)
    response.set_cookie(REFRESH_COOKIE, refresh, max_age=REFRESH_MAX_AGE, **common)

def clear_auth_cookies(response):
    samesite = getattr(settings, "AUTH_COOKIE_SAMESITE", "Lax")
    for name in (ACCESS_COOKIE, REFRESH_COOKIE):
        response.delete_cookie(name, path="/", samesite=samesite)
```

```python
# settings.py
import os
AUTH_COOKIE_SAMESITE = os.getenv("AUTH_COOKIE_SAMESITE", "Lax" if DEBUG else "None")
AUTH_COOKIE_SECURE = (not DEBUG) or AUTH_COOKIE_SAMESITE == "None"
```

Set cookies without a `domain` (host-only) unless you genuinely need them shared
across subdomains.

## 5. Auth views

Login authenticates, mints a token pair, and sets cookies. The response body also
returns the tokens, which is what non-browser clients use. `RefreshToken.for_user`
is the standard mint.

```python
# accounts/views.py
from django.contrib.auth import authenticate
from django.utils import timezone
from django.utils.decorators import method_decorator
from django_ratelimit.decorators import ratelimit
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from .cookies import set_auth_cookies, clear_auth_cookies

@method_decorator(ratelimit(key="ip", rate="10/5m", method="POST", block=True), name="post")
class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = (request.data.get("email") or "").strip().lower()
        password = request.data.get("password") or ""
        user = authenticate(request, username=email, password=password)
        if user is None:                       # ModelBackend already enforces is_active
            return Response({"error": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED)

        user.last_login = timezone.now()
        user.save(update_fields=["last_login"])
        refresh = RefreshToken.for_user(user)
        access, refresh_str = str(refresh.access_token), str(refresh)

        body = {
            "user": {"id": str(user.uuid), "email": user.email, "primary_role": user.primary_role,
                     "is_staff": user.is_staff},
            "tokens": {"access": access, "refresh": refresh_str},
        }
        response = Response(body, status=status.HTTP_200_OK)
        set_auth_cookies(response, access, refresh_str)
        return response
```

Register and verify. Create the user inactive, email a short-lived numeric code,
and do not issue tokens until the email is verified. Verify flips `is_active`,
mints the token pair, and sets cookies so the post-signup redirect lands
authenticated. Rate-limit and cap attempts on both verify and resend (see the
gotchas: a 6-digit code with no lockout is brute-forceable, and resend is an
email-spam and account-enumeration oracle if responses differ by account state).

Logout reads the refresh from body or cookie, blacklists it, and clears cookies.
Make blacklist failure non-fatal so logout always succeeds.

```python
class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        token = request.data.get("refresh_token") or request.COOKIES.get("refresh_token")
        if token:
            try:
                RefreshToken(token).blacklist()
            except Exception:
                pass                            # already expired or invalid: logout still wins
        response = Response({"message": "Logged out"}, status=status.HTTP_200_OK)
        clear_auth_cookies(response)
        return response
```

Refresh, hardened. This is where most JWT implementations are weak. Two additions
over stock SimpleJWT:

1. Replay cascade. A presented-but-already-blacklisted refresh token means the
   token was rotated once and is being shown again, which is the signature of a
   stolen refresh token. Decode it without verifying the signature to read the
   user id, then blacklist every outstanding token for that user.
2. User reload. SimpleJWT's refresh serializer never loads the user, so a stolen
   refresh cookie keeps minting access tokens after the account is disabled.
   Reload the user by the `user_id` claim and refuse if inactive or deleted.

```python
import jwt
from rest_framework_simplejwt.views import TokenRefreshView as BaseTokenRefreshView
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.token_blacklist.models import OutstandingToken, BlacklistedToken
from .models import User

def cascade_revoke_user_tokens(refresh_token):
    payload = jwt.decode(refresh_token, options={"verify_signature": False}, algorithms=["HS256"])
    for ot in OutstandingToken.objects.filter(user_id=payload["user_id"]):
        BlacklistedToken.objects.get_or_create(token=ot)

@method_decorator(ratelimit(key="ip", rate="30/m", method="POST", block=True), name="post")
class TokenRefreshView(BaseTokenRefreshView):
    def post(self, request, *args, **kwargs):
        token = request.data.get("refresh") or request.COOKIES.get("refresh_token")
        if not token:
            return Response({"error": "Refresh token required"}, status=400)
        request.data._mutable = getattr(request.data, "_mutable", True)
        request.data["refresh"] = token

        try:
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)
        except TokenError as e:
            if "blacklisted" in str(e).lower():
                cascade_revoke_user_tokens(token)        # suspected theft: kill all sessions
            raise InvalidToken("Token is invalid or expired")

        payload = jwt.decode(token, options={"verify_signature": False}, algorithms=["HS256"])
        user = User.objects.filter(id=payload["user_id"]).first()
        if not user or user.is_deleted or not user.is_active:
            response = Response({"error": "Account is no longer active."}, status=401)
            clear_auth_cookies(response)
            return response

        data = serializer.validated_data
        response = Response(data, status=200)
        set_auth_cookies(response, data["access"], data.get("refresh", token))
        return response
```

Use a custom refresh serializer that returns the new refresh token (stock SimpleJWT
returns only `access` when rotation is on):

```python
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.tokens import RefreshToken

class RotatingTokenRefreshSerializer(TokenRefreshSerializer):
    def validate(self, attrs):
        refresh = RefreshToken(attrs["refresh"])
        data = {"access": str(refresh.access_token)}
        if api_settings.ROTATE_REFRESH_TOKENS:
            if api_settings.BLACKLIST_AFTER_ROTATION:
                try:
                    refresh.blacklist()
                except AttributeError:
                    pass
            refresh.set_jti(); refresh.set_exp(); refresh.set_iat()
            data["refresh"] = str(refresh)
        return data
```

`/me/` returns the profile (UUID, never the PK; a `has_password` boolean, never
the hash) and uses `IsAuthenticated`. PATCH whitelists editable fields.

## 6. Token revocation

Stateless tokens need an off switch. Use two primitives.

Per-JTI blacklist (logout, targeted kills):

```python
# accounts/models.py
class RevokedToken(models.Model):
    jti = models.CharField(max_length=255, unique=True, db_index=True)
    user = models.ForeignKey("accounts.User", on_delete=models.CASCADE)
    reason = models.CharField(max_length=32)         # LOGOUT, ROLE_CHANGED, SECURITY, ...
    revoked_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()              # for periodic cleanup

    @classmethod
    def is_revoked(cls, jti):
        return cls.objects.filter(jti=jti).exists()
```

Per-user watermark (log this account out everywhere, one write). To revoke:

```python
from datetime import timedelta
user.tokens_invalidated_after = timezone.now() + timedelta(seconds=1)  # +1s: iat is second-resolution
user.save(update_fields=["tokens_invalidated_after"])
```

A middleware checks both on every authenticated request, after Django's
`AuthenticationMiddleware`:

```python
# accounts/middleware.py
from datetime import datetime, timezone as tz
from django.http import JsonResponse
from rest_framework_simplejwt.tokens import AccessToken
from .models import RevokedToken

EXCLUDED = ("/api/v1/auth/login/", "/api/v1/auth/register/", "/api/v1/auth/token/refresh/",
            "/api/v1/auth/verify-email/", "/admin/", "/static/", "/media/")

class TokenRevocationMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if not request.path.startswith(EXCLUDED) and getattr(request, "user", None) and request.user.is_authenticated:
            token = self._raw_token(request)
            if token:
                try:
                    at = AccessToken(token)
                    jti, iat = at.get("jti"), at.get("iat")
                    if jti and RevokedToken.is_revoked(jti):
                        return JsonResponse({"code": "token_revoked"}, status=401)
                    watermark = request.user.tokens_invalidated_after
                    if iat and watermark and datetime.fromtimestamp(iat, tz.utc) <= watermark:
                        return JsonResponse({"code": "session_invalidated"}, status=401)
                except Exception:
                    pass                              # let the real authenticator emit the 401
        return self.get_response(request)

    def _raw_token(self, request):
        h = request.headers.get("Authorization", "")
        if h.startswith("Bearer "):
            return h.split(" ", 1)[1]
        return request.COOKIES.get("access_token")
```

Do not cache the revocation lookups. A cached "not revoked" reopens the window you
are trying to close. The unique index on `jti` keeps the query cheap.

## 7. Rate limiting

django-ratelimit on the auth endpoints, IP-keyed, hard block before the view runs.
This is the brute-force and credential-stuffing defense, independent of auth. It is
separate from DRF throttles, which protect general API capacity. On limit,
django-ratelimit raises `Ratelimited` (a `PermissionDenied` subclass), rendered as
403.

```python
@method_decorator(ratelimit(key="ip", rate="5/h", method="POST", block=True), name="post")    # register
@method_decorator(ratelimit(key="ip", rate="10/5m", method="POST", block=True), name="post")   # login
@method_decorator(ratelimit(key="ip", rate="30/m", method="POST", block=True), name="post")     # refresh
```

Also rate-limit forgot-password, reset-password, verify-email, and resend-code.
Note the tradeoff: IP keying means NAT'd corporate users share a budget. Behind a
proxy, the limiter trusts `X-Forwarded-For`, which is safe only if the proxy
overwrites it.

## 8. DRF defaults

```python
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "accounts.authentication.CookieOrBearerJWTAuthentication",
        # SessionAuthentication only if you need the browsable API or Django admin
        # via session. See the CSRF gotcha at the end of this file.
    ),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticated",),
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {"anon": "30/min", "user": "300/min"},
    "NUM_PROXIES": 1,   # read client IP from the last X-Forwarded-For hop, not REMOTE_ADDR
}
```

`NUM_PROXIES = 1` matters behind a load balancer. Without it, throttles see the
proxy's internal IP for everyone and share one bucket.

## 9. Security settings behind a proxy

TLS terminates at the proxy, which speaks plain HTTP to the app and sets
`X-Forwarded-Proto`. Without `SECURE_PROXY_SSL_HEADER`, `request.is_secure()` is
always False and Django silently drops the HSTS header and refuses to set secure
cookies. This is a real and confusing production symptom.

```python
# settings.py, inside `if not DEBUG:`
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = False                 # the proxy handles HTTP -> HTTPS; True loops
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True

SESSION_COOKIE_SECURE = True
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SECURE = True
CSRF_COOKIE_SAMESITE = "Lax"

SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"

CSRF_TRUSTED_ORIGINS = ["https://app.example.com", "https://www.example.com"]

# CORS for cross-origin cookie auth
CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOWED_ORIGINS = ["https://app.example.com", "https://www.example.com"]
CORS_ALLOW_CREDENTIALS = True               # required so the browser sends cookies
CORS_ALLOW_HEADERS = [..., "authorization", "x-csrftoken", "x-organization-id"]
```

The tenant header must be in `CORS_ALLOW_HEADERS` or the browser strips it. If the
app runs on ECS or similar, append the container's private IP to `ALLOWED_HOSTS`
at startup so proxy health checks (which hit the rotating private IP) pass.

## 10. RBAC

Two role planes, both per-organization, both read from the DB per request:

- Persona (business context): tenant, landlord, agent.
- Organizational (permission hierarchy): owner, admin, member, external.

```python
# accounts/models.py
class UserRole(models.Model):
    user = models.ForeignKey("accounts.User", on_delete=models.CASCADE)
    role = models.ForeignKey("accounts.Role", on_delete=models.CASCADE)
    organization = models.ForeignKey("accounts.Organization", on_delete=models.CASCADE)
    is_deactivated = models.BooleanField(default=False)   # soft removal, not delete
```

```python
# accounts/permissions.py
from rest_framework.permissions import BasePermission

class IsLandlord(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        if not user.is_authenticated:
            return False
        if user.is_staff or user.is_superuser:
            return True
        if user.primary_role == "LANDLORD":               # fast path: onboarding hint
            return True
        # authoritative: an active landlord role in any org the user belongs to
        return UserRole.objects.filter(
            user=user, role__name="LANDLORD", is_deactivated=False
        ).exists()
```

A persona gate passing in "any org" is intentional for multi-persona users, but it
means the permission class is not your data boundary. Always scope querysets by
`request.organization` as well. Authorization decides "can this user act"; the
queryset filter decides "on whose data."

## 11. Tenant scoping

One rule: active org from the `X-Organization-ID` header, verified against
membership, never guessed. Resolve it after DRF authentication (the user is
anonymous during middleware `process_view` for token auth), typically in a small
helper that permission classes and views call.

```python
# accounts/scoping.py
from .models import Organization, UserRole

def ensure_request_organization(request):
    user = request.user
    if not user or not user.is_authenticated:
        return
    org_id = request.headers.get("X-Organization-ID")
    if not org_id:
        return                                    # no header: request scopes to the user's own data
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
        request.organization = org                # else leave it None: never guess another org
```

The failure mode you are preventing: with no header, an "use their admin org, else
first org" guess silently resolves the wrong org and bleeds one persona's data into
another's view. Leaving it None and self-scoping is the fix. Write a smoke test
that asserts org A cannot read org B's rows.

## 12. Caching

Use Redis for the things that are allowed to be slightly stale or are
infrastructural, and Postgres for the things that must be correct now.

- Cache: DRF throttle counters and django-ratelimit buckets (shared across
  replicas, survive restarts), and third-party OAuth tokens you fetch on behalf of
  the app (cache with a safety margin under their real TTL).
- Do not cache: the revocation lookups (per-JTI and watermark). Correctness over
  latency. A cached "not revoked" is a security hole.

A Redis outage degrades rate limiting (django-ratelimit tends to fail open), so
treat Redis as availability-sensitive, not just performance.

## The SessionAuthentication CSRF gotcha

If you keep `rest_framework.authentication.SessionAuthentication` in the defaults
(common, for the browsable API and Django admin), you inherit a trap. DRF tries
authenticators in order; a valid JWT wins first and there is no problem. But if JWT
auth returns None (no token, or an expired access cookie on the graceful path) and
the browser still carries a Django `sessionid` (the developer or QA logged into
`/admin/` in the same browser), SessionAuthentication kicks in and enforces CSRF on
every unsafe method. The result is a confusing 403 "CSRF Failed" on an API call you
expected to be pure JWT, and the error points at CSRF instead of the real cause (a
stray session cookie).

For a pure-JWT API, drop SessionAuthentication from `DEFAULT_AUTHENTICATION_CLASSES`
and add it only to the specific views that need session auth. The Django admin does
not depend on DRF's auth classes, so removing it does not break the admin.
