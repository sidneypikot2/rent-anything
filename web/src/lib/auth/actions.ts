import { apiClient } from "@/api/client";
import { refreshSession } from "./middleware";
import { clearSession, getSession, isAnonymous, saveSession, saveSessionUser, type AuthTokens, type User } from "./session";

// The entry point a form is on decides the account's role (SPEC: three entry points).
export type Role = User["role"];
export type SelfServeRole = Exclude<Role, "admin">;
export type OauthProvider = "google" | "facebook";

type Result = { ok: true; user: User } | { ok: false; error: string };

type ErrorBody = { error?: string; errors?: string[] } | undefined;

function finish(data: AuthTokens | undefined, error: ErrorBody): Result {
  if (data) {
    saveSession(data);
    return { ok: true, user: data.user };
  }
  const message = error?.error ?? error?.errors?.join(". ") ?? "Something went wrong. Try again.";
  return { ok: false, error: message };
}

// A guest with no account yet signing in or up brings their trips into the account (RAA-175):
// the API takes them from the request's access token, which may have expired since the last
// add, so it is renewed first.
async function sendGuestToken() {
  if (isAnonymous(getSession())) await refreshSession();
}

export async function signIn(body: { email: string; password: string; role: Role }) {
  await sendGuestToken();
  const { data, error } = await apiClient().POST("/api/v1/session", { body });
  return finish(data, error);
}

// Email and password only; name and phone are set later (PUT /api/v1/me/complete_profile).
export async function signUp(body: { email: string; password: string; role: SelfServeRole }) {
  await sendGuestToken();
  const { data, error } = await apiClient().POST("/api/v1/registrations", { body });
  return finish(data, error);
}

export async function oauthSignIn(provider: OauthProvider, token: string, role: SelfServeRole) {
  await sendGuestToken();
  const { data, error } = await apiClient().POST("/api/v1/oauth/{provider}", {
    params: { path: { provider } },
    body: { token, role },
  });
  return finish(data, error);
}

// A guest with no account yet (RAA-175), made by a signed-out first add so the trip has an
// owner. Kept like any session: this is the guest's own browser.
export async function startGuestSession() {
  const { data, error } = await apiClient().POST("/api/v1/guest_sessions");
  return finish(data, error);
}

// Opening a trip link with its PIN (RAA-177): a session for this tab only, so the next open
// asks again. 423 once the link is locked.
export async function unlockTripLink(token: string, pin: string) {
  const { data, error, response } = await apiClient().POST("/api/v1/trip_access/unlock", { body: { token, pin } });
  if (data) {
    saveSession(data, { tabOnly: true });
    return { ok: true as const, user: data.user };
  }
  return { ...finish(undefined, error), locked: response.status === 423 } as { ok: false; error: string; locked: boolean };
}

// Emails a one-time code; the API answers 202 whether or not the email has an account.
export async function requestSignInCode(email: string) {
  const { error, response } = await apiClient().POST("/api/v1/sign_in_codes", { body: { email } });
  if (response.status === 202) return { ok: true as const };
  return { ok: false as const, error: (error as ErrorBody)?.error ?? "Couldn't send a code. Try again." };
}

// Signing in with an emailed code. From a guest with no email yet (checkout with an email
// already in use), the API moves their trips into that account first. tabOnly: recovering
// from a trip link, whose sessions last one tab.
export async function verifySignInCode(email: string, code: string, { tabOnly = false } = {}) {
  await sendGuestToken();
  const { data, error } = await apiClient().POST("/api/v1/sign_in_codes/verify", { body: { email, code } });
  if (data) {
    saveSession(data, { tabOnly });
    return { ok: true as const, user: data.user };
  }
  return finish(undefined, error);
}

// Reads the signed-in user again (GET /me) into the session: after a first checkout, which
// gives a guest without an account their email.
export async function refreshSessionUser() {
  const { data } = await apiClient().GET("/api/v1/me");
  if (data) saveSessionUser(data);
}

export async function signOut() {
  const session = getSession();
  clearSession({ all: true });
  if (session) {
    await apiClient().DELETE("/api/v1/session", { body: { refresh_token: session.refreshToken } });
  }
}
