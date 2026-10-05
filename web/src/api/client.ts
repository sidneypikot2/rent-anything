import createClient from "openapi-fetch";
import { authMiddleware } from "@/lib/auth/middleware";
import { apiBaseUrl } from "@/lib/config";
import type { paths } from "./schema";

// The one way the web app talks to the Rails API. Paths, params and response bodies are
// typed from schema.d.ts, which is generated from backend/swagger/v1/openapi.yaml
// (`npm run api:types`) — never call fetch against the API directly. In the browser it
// also sends the signed-in user's access token (src/lib/auth/).
export function apiClient() {
  const client = bareApiClient();
  if (typeof window !== "undefined") client.use(authMiddleware);
  return client;
}

// Without the auth middleware: only for the token refresh inside that middleware, which
// must not recurse into itself.
export function bareApiClient() {
  return createClient<paths>({ baseUrl: apiBaseUrl() });
}
