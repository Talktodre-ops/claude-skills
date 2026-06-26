# claude-skills

A small collection of [Claude Code](https://www.anthropic.com/claude-code) skills.

## Skills

### auth

A blueprint for production-grade full-stack authentication and authorization,
distilled from a real Django + Next.js system.

It covers dual-transport JWT (HTTPOnly cookies for browsers, Bearer for API and
mobile), refresh rotation with blacklist and replay detection, stateless
validation plus per-token and per-user revocation, RBAC with persona and
organization roles, multi-tenant scoping from a single header, rate limiting,
caching, and the cookie, CSRF, CORS, and header posture for an app behind a
TLS-terminating proxy.

- [`auth/SKILL.md`](auth/SKILL.md): the entry point. Architecture, design
  decisions and their tradeoffs, build order, and the non-negotiables.
- [`auth/references/backend-django.md`](auth/references/backend-django.md): the
  Django, DRF, and SimpleJWT recipe with real code.
- [`auth/references/frontend-react.md`](auth/references/frontend-react.md): the
  React and Next.js recipe.
- [`auth/references/security-checklist.md`](auth/references/security-checklist.md):
  the ship checklist, the known gaps to fix, and how to adapt the blueprint to a
  single-tenant app, a mobile API, RS256, or TOTP 2FA.

## Using a skill

Copy or symlink a skill directory into `~/.claude/skills/` (global) or a project's
`.claude/skills/` directory. Claude Code loads it when a task matches its
description, or you can invoke it by name.
