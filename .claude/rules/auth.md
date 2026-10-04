---
paths:
  - "backend/app/services/auth/**"
  - "backend/app/controllers/**"
  - "backend/app/models/user.rb"
  - "web/src/lib/auth/**"
  - "web/src/components/auth/**"
  - "web/src/app/partner/**"
---

# Auth and roles (RAA-23)

**One `users` table, role fixed by the entry point.** `role` is `guest`, `partner` or `admin` (CHECK constraint). The client sends the role of the page it is on (`/login` → `guest`, `/partner/login` → `partner`, `/admin` → `admin`), never one the user picks. Sign-up and Google/Facebook accept only `guest` and `partner` (`User::SELF_SERVE_ROLES`); admins are never self-made. An existing account signing in on another role's page gets 403 — it is not converted.

**Tokens**: every sign-in returns `Auth::IssueTokens` — a 15-minute JWT access token (`sub`, `role`) and a 30-day refresh token stored only as a SHA-256 digest. `POST /api/v1/tokens/refresh` rotates it; presenting a spent token revokes all of that user's sessions. Don't raise inside the refresh transaction — the revocation would roll back with it.

**Endpoints that need a user**: `before_action :authenticate_user!` (401), then `require_role!("partner")` (403) — or scope through `current_user`. Everything under `/api/v1/partner` is partner-only; its request specs cover signed out (401) and a guest (403).

**OAuth** is verified server-side only: `Auth::Providers::Google` (ID token, audience `GOOGLE_CLIENT_ID`) and `Auth::Providers::Facebook` (`debug_token` against `FACEBOOK_APP_ID`, then `/me` with `appsecret_proof`). A provider login links to an existing account by email only when the provider vouches for the email (Google's `email_verified`); Facebook's never links. Specs stub `Auth::Providers::*.verify`; nothing calls Google or Facebook from a spec.

**Web**: the session (tokens + user) is in localStorage via `src/lib/auth/session.ts`; `useSession()` is `undefined` until hydration — wait it out before redirecting. `apiClient()` adds the bearer token in the browser and refreshes once on a 401 GET. New partner pages go in `src/app/partner/(protected)/`, behind `PartnerGuard`; only `/partner/login` sits outside it. The guard is UX — the API's 401/403 is the real check.
