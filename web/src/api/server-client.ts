import createClient from "openapi-fetch";
import { apiBaseUrl } from "@/lib/config";
import type { paths } from "./schema";

// The typed API client for Server Components on public pages. apiClient() can't be used
// there: it imports the auth middleware, whose session store is browser-only and breaks
// the server build. No token is sent, so only public endpoints.
export function serverApiClient() {
  return createClient<paths>({ baseUrl: apiBaseUrl() });
}
