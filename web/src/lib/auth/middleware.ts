import type { Middleware } from "openapi-fetch";
import { bareApiClient } from "@/api/client";
import { clearSession, getSession, REFRESH_COOKIE, saveSession, type Session } from "./session";

// One refresh at a time in this tab: requests that hit an expired token together share it.
let refreshing: Promise<string | null> | null = null;

// A trip link's session refreshes with its own token, in the body, never the cookie.
async function refreshTabOnly(session: Session): Promise<string | null> {
  const { data, response } = await bareApiClient().POST("/api/v1/tokens/refresh", {
    body: { refresh_token: session.refreshToken ?? "" },
  });
  if (!data) {
    if (response.status === 401) clearSession();
    return null;
  }
  saveSession(data);
  return data.access_token;
}

// The browser's own session refreshes with the cookie (RAA-226), which every tab shares and each
// refresh rotates. A session from before the cookie sends its stored token once, which the API
// moves into the cookie.
function postRefresh(refreshToken?: string) {
  return bareApiClient().POST("/api/v1/tokens/refresh", {
    params: { header: REFRESH_COOKIE.headers },
    credentials: REFRESH_COOKIE.credentials,
    body: refreshToken ? { refresh_token: refreshToken } : {},
  });
}

// Tabs take turns (Web Locks), so no two send the same cookie at once. Where the browser has no
// locks, or another tab rotated the cookie between our read and the API's, a failed refresh is
// tried once more with the cookie as it is now.
async function inTurn<T>(work: () => Promise<T>): Promise<T> {
  if (typeof navigator !== "undefined" && navigator.locks) return (await navigator.locks.request("raa.refresh", work)) as T;
  return work();
}

async function refreshWithCookie(session: Session): Promise<string | null> {
  const { data, response } = await inTurn(async () => {
    const first = await postRefresh(session.refreshToken);
    return first.data || first.response.status !== 401 ? first : postRefresh();
  });
  if (!data) {
    // Only a 401 ends it (the token is spent, expired or revoked); a rate limit or the API being
    // down keeps it for the next try. And only if it is still the session that failed: another
    // tab may have signed someone else in meanwhile.
    const current = getSession();
    if (response.status === 401 && current?.user.id === session.user.id && !current.tabOnly) clearSession();
    return null;
  }
  saveSession(data, { tabOnly: false });
  return data.access_token;
}

async function refreshAccessToken(): Promise<string | null> {
  const session = getSession();
  if (!session) return null;
  return session.tabOnly ? refreshTabOnly(session) : refreshWithCookie(session);
}

// Refreshes the access token now, sharing a refresh already under way. Null when there is no
// session or it can't be renewed.
export function refreshSession(): Promise<string | null> {
  refreshing ??= refreshAccessToken().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

// This tab's access token, refreshing first when it has none yet (after a reload, or a sign-in
// in another tab). Null when signed out.
export async function currentAccessToken(): Promise<string | null> {
  const session = getSession();
  if (!session) return null;
  return session.accessToken ?? refreshSession();
}

// Browser only (added in apiClient): sends the access token and, when a GET comes back
// 401 because it expired, refreshes once and retries. Writes aren't retried — their
// body is already spent — and none of today's signed-in endpoints are writes.
export const authMiddleware: Middleware = {
  async onRequest({ request }) {
    if (request.headers.has("Authorization")) return request;
    const token = await currentAccessToken();
    if (token) request.headers.set("Authorization", `Bearer ${token}`);
    return request;
  },

  async onResponse({ request, response }) {
    if (response.status !== 401 || request.method !== "GET") return response;
    if (!request.headers.has("Authorization")) return response;

    const token = await refreshSession();
    if (!token) return response;

    const retry = new Request(request);
    retry.headers.set("Authorization", `Bearer ${token}`);
    return fetch(retry);
  },
};
