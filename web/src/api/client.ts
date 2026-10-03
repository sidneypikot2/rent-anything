import createClient from "openapi-fetch";
import { apiBaseUrl } from "@/lib/config";
import type { paths } from "./schema";

// The one way the web app talks to the Rails API. Paths, params and response bodies are
// typed from schema.d.ts, which is generated from backend/swagger/v1/openapi.yaml
// (`npm run api:types`) — never call fetch against the API directly.
export function apiClient() {
  return createClient<paths>({ baseUrl: apiBaseUrl() });
}
