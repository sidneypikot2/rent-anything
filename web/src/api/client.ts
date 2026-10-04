import createClient from "openapi-fetch";
import { authMiddleware } from "@/lib/auth/middleware";
import { apiBaseUrl } from "@/lib/config";
import type { paths } from "./schema";

// The one way the web app talks to the Rails API. Paths, params and response bodies are
// typed from schema.d.ts, which is generated from backend/swagger/v1/openapi.yaml
// (`npm run api:types`) — never call fetch against the API directly. In the browser it
// also sends the signed-in user's access token (src/lib/auth/).
export function apiClient() {
  const client = createClient<paths>({ baseUrl: apiBaseUrl() });
  if (typeof window !== "undefined") client.use(authMiddleware);
  return client;
}
