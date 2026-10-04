---
paths:
  - "backend/app/controllers/concerns/authentication.rb"
  - "backend/app/controllers/api/v1/{registrations,sessions,me}_controller.rb"
  - "backend/app/services/auth/**"
  - "backend/app/models/{user,refresh_token}.rb"
  - "backend/app/lib/json_web_token.rb"
---

# Auth and accounts

Built in RAA-22. Phone OTP isn't built yet (it waits on an SMS provider): `users.phone` is stored but unverified, so nothing may rely on it.

**Tokens.** An access token is a 15-minute HS256 JWT (`JsonWebToken`, payload `sub` = user id) sent as `Authorization: Bearer`. A refresh token lasts 30 days. Only its SHA-256 digest is stored (`refresh_tokens.token_digest`), so the raw value exists only in the response that issued it. `Auth::SessionIssuer` is the one place that issues both. Don't put roles or other claims in the JWT: `authenticate_user!` loads the user on every request, so a role change or a deleted user takes effect at once.

**Rotation.** `POST /sessions/refresh` revokes the token it is given and issues a new pair. Presenting a token that was already revoked means it was replayed, so every active token of that user is revoked (`Auth::Refresh`). Keep the raise outside the `with_lock` block: an exception inside rolls back that revocation. Sign-out revokes the given refresh token; the access token just runs out.

**Roles** (`guest`, `partner`, `admin`, with a CHECK in the database) never come from a request, with one exception: sign-up may ask for `guest` or `partner`. Admins are created by hand (development: `db/seeds.rb`). Changing a role is an admin action, never `PATCH /me`.

**Protecting an endpoint**: `before_action :authenticate_user!` (401 when there is no valid token), then `require_role!(:partner)` or scope through `current_user` (403 via `NotAuthorizedError`). 401 means "sign in again" to the client and 403 means "not yours", so don't swap them. Every protected endpoint has specs for no token (401), the wrong role or wrong user (403/404), and the happy path.

**Credentials errors** raise `Auth::InvalidCredentials` (401). The message is the same whether the email is unknown or the password is wrong, and `User.authenticate_by` keeps the timing the same — don't add a lookup that tells the two apart.

**Rate limits**: sign-up and sign-in use Rails' `rate_limit` (10 per 3 minutes per IP). It counts in the cache store: `null_store` in test (never limits), `memory_store` in development (per process), Solid Cache in production.
