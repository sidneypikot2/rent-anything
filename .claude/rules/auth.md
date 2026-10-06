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

**One `users` table, role fixed by the entry point.** `role` is `guest`, `partner` or `admin` (CHECK constraint). The client sends the role of the page it is on (`/login` and `/register` → `guest`, `/partner/login` and `/partner/register` → `partner`, `/admin` → `admin`), never one the user picks. Sign-up and Google/Facebook accept only `guest` and `partner` (`User::SELF_SERVE_ROLES`); admins are never self-made.

**Email is unique per role** (RAA-29): unique `(email, role)`, and the validation is scoped to `role`. One person can have a guest account and a partner account with the same address, each with its own password, and they are separate users. Every sign-in looks up `(email, role)` for the page's role, so on another role's page that account just isn't found: a 401, never a 403, and never converted. Anything that finds a user by email must also scope it to a role.

**Tokens**: every sign-in returns `Auth::IssueTokens` — a 15-minute JWT access token (`sub`, `role`) and a 30-day refresh token stored only as a SHA-256 digest. `POST /api/v1/tokens/refresh` rotates it; presenting a token spent more than a minute ago revokes all of that user's sessions (within the minute it is two tabs refreshing at once, and the browser picks up the other tab's new session). Don't raise inside the refresh transaction — the revocation would roll back with it.

**Endpoints that need a user**: `before_action :authenticate_user!` (401), then `require_role!("partner")` (403) — or scope through `current_user`. Everything under `/api/v1/partner` is partner-only; its request specs cover signed out (401) and a guest (403).

**Rate limit**: endpoints that sign in or sign up call `limit_auth_attempts only: :create` (`ApplicationController`, Rails `rate_limit`, `AUTH_RATE_LIMIT` per IP per endpoint), which answers 429 with the `error` schema. The test cache is a null store, so specs use `exceed_auth_rate_limit(Controller)`.

**Complete profile** (RAA-32): sign-up takes only email and password, and a Google/Facebook account has no phone, so every new guest or partner starts with `users.registration_complete = false` and a possibly null `name`. `PUT /api/v1/me/complete_profile` (`Users::CompleteProfile`) requires both `name` and `phone` and sets the flag; from then on the model and a CHECK constraint keep both present. The web app doesn't call it or route on the flag yet, so anything showing a user's name falls back to the email. A phone, whenever it is saved, must be a phone number (`User` validation).

**Profile**: `PATCH /api/v1/me` (`Users::UpdateProfile`) changes `name` and `phone` only — email and password changes need verification and a current-password check first. Once the profile is complete, neither can be cleared. A partner's business profile is separate (RAA-40): `GET`/`PUT /api/v1/partner/profile` (`Partners::UpdateProfile`, table `partner_profiles`) — legal first and last name, phone (saved on the user) and a full address are required, `display_name` is optional, and `complete` is true once it is saved with a phone.

**OAuth** is verified server-side only: `Auth::Providers::Google` (ID token, audience `GOOGLE_CLIENT_ID`) and `Auth::Providers::Facebook` (`debug_token` against `FACEBOOK_APP_ID`, then `/me` with `appsecret_proof`). Identities are per role too. `oauth_identities.role` is unique with `(provider, uid, role)` and kept equal to the user's by a composite FK to `users (id, role)`. So the same Google account on `/login` uses or creates the guest account, and on `/partner/login` the partner account. Within the page's role, a provider login links to an existing account by email only when the provider vouches for the email (Google's `email_verified`) **and** that account has no password — email sign-ups don't prove they own the address, so linking one would hand the real owner's Google login to whoever registered it first. Facebook's email never links. Proper email verification (M1) can relax this. Specs stub `Auth::Providers::*.verify`; nothing calls Google or Facebook from a spec.

**Web**: the session (tokens + user) is in localStorage via `src/lib/auth/session.ts`; `useSession()` is `undefined` until hydration — wait it out before redirecting. `apiClient()` adds the bearer token in the browser and refreshes once on a 401 GET; `bareApiClient()` (no middleware) is only for that refresh. Signing in lands on the role's dashboard (`DASHBOARD_PATHS` in `src/lib/auth/paths.ts`: `/dashboard`, `/partner/dashboard`, `/admin`). The header's signed-out Sign in / Create an account links are hidden on `/login` and `/register`; signed in, guests and partners get an account menu (`AccountMenu`: Profile, Settings, Sign out — `/profile`, `/settings` or `/partner/profile`, `/partner/settings`), admins their name and Sign out. Signed-in guest pages go in `src/app/(guest)/(signed-in)/` and partner pages in `src/app/partner/(protected)/`, both behind `RoleGuard`; only `/partner/login`, `/partner/register` (and `/partner`, a redirect) sit outside the partner group. Sign-in and sign-up are separate routes (`LOGIN_PATHS`, `REGISTER_PATHS`); `AuthCard` takes its `mode` from the page, it doesn't toggle. The guard is UX — the API's 401/403 is the real check.
