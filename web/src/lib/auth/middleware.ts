import createClient, { type Middleware } from "openapi-fetch";
import type { paths } from "@/api/schema";
import { apiBaseUrl } from "@/lib/config";
import { clearSession, getSession, saveSession } from "./session";

// One refresh at a time: requests that hit an expired token together share it.
let refreshing: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const session = getSession();
  if (!session) return null;

  // A bare client (no middleware), so a failed refresh can't recurse.
  const { data } = await createClient<paths>({ baseUrl: apiBaseUrl() }).POST(
    "/api/v1/tokens/refresh",
    { body: { refresh_token: session.refreshToken } },
  );
  if (!data) {
    clearSession();
    return null;
  }
  saveSession(data);
  return data.access_token;
}

// Browser only (added in apiClient): sends the access token and, when a GET comes back
// 401 because it expired, refreshes once and retries. Writes aren't retried — their
// body is already spent — and none of today's signed-in endpoints are writes.
export const authMiddleware: Middleware = {
  onRequest({ request }) {
    const session = getSession();
    if (session && !request.headers.has("Authorization")) {
      request.headers.set("Authorization", `Bearer ${session.accessToken}`);
    }
    return request;
  },

  async onResponse({ request, response }) {
    if (response.status !== 401 || request.method !== "GET") return response;
    if (!request.headers.has("Authorization")) return response;

    refreshing ??= refreshAccessToken().finally(() => {
      refreshing = null;
    });
    const token = await refreshing;
    if (!token) return response;

    const retry = new Request(request);
    retry.headers.set("Authorization", `Bearer ${token}`);
    return fetch(retry);
  },
};
