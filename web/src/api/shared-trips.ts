import { connection } from "next/server";
import { cache } from "react";
import { serverApiClient } from "./server-client";
import type { components } from "./schema";

export type SharedTrip = components["schemas"]["shared_trip"];

// A trip shared with a view-only link (RAA-178), for its public page. null when the token is
// unknown, or was replaced or revoked. Cached per request: the page and its metadata share one
// call.
export const getSharedTrip = cache(async (token: string): Promise<SharedTrip | null> => {
  await connection();
  const { data, response } = await serverApiClient().GET("/api/v1/shared_trips/{token}", {
    params: { path: { token } },
  });
  if (response.status === 404) return null;
  if (!data) throw new Error("Couldn't load this trip");
  return data;
});
