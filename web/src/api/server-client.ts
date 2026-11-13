import createClient from "openapi-fetch";
import { apiBaseUrl } from "@/lib/config";
import type { paths } from "./schema";

// The typed API client for Server Components on public pages. apiClient() can't be used
// there: it imports the auth middleware, whose session store is browser-only and breaks
// the server build. No token is sent, so only public endpoints.
// `revalidate` (seconds) keeps the answers in Next's data cache for that long instead of
// fetching per request — only for what every page shows and may be a few minutes old (the
// footer's destinations, RAA-231); a page that reads it can then stay static.
export function serverApiClient({ revalidate }: { revalidate?: number } = {}) {
  return createClient<paths>({
    baseUrl: apiBaseUrl(),
    ...(revalidate !== undefined && { fetch: (request: Request) => fetch(request, { next: { revalidate } }) }),
  });
}
