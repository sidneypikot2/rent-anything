import { apiClient } from "@/api/client";
import { clearSession, getSession, saveSession, type AuthTokens, type User } from "./session";

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

export async function signIn(body: { email: string; password: string; role: Role }) {
  const { data, error } = await apiClient().POST("/api/v1/session", { body });
  return finish(data, error);
}

export async function signUp(body: {
  email: string;
  name: string;
  phone?: string;
  password: string;
  role: SelfServeRole;
}) {
  const { data, error } = await apiClient().POST("/api/v1/registrations", { body });
  return finish(data, error);
}

export async function oauthSignIn(provider: OauthProvider, token: string, role: SelfServeRole) {
  const { data, error } = await apiClient().POST("/api/v1/oauth/{provider}", {
    params: { path: { provider } },
    body: { token, role },
  });
  return finish(data, error);
}

export async function signOut() {
  const session = getSession();
  clearSession();
  if (session) {
    await apiClient().DELETE("/api/v1/session", { body: { refresh_token: session.refreshToken } });
  }
}
