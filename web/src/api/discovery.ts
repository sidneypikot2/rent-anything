import { connection } from "next/server";
import { cache } from "react";
import { serverApiClient } from "./server-client";
import type { components } from "./schema";

// Guest discovery (RAA-33): destinations, activities, one area, and search. These run in
// Server Components; connection() keeps them out of the build-time prerender, so the
// pages always show the current data and `next build` never needs the API.

export type AreaCard = components["schemas"]["area_card"];
export type AreaDetail = components["schemas"]["area_detail"];
export type ListingDetail = components["schemas"]["listing_detail"];
export type Activity = components["schemas"]["activity"];
export type SearchResults = components["schemas"]["search_results"];
export type Explore = components["schemas"]["explore"];
export type ExploreListing = components["schemas"]["explore_listing"];
export type ExplorePlace = components["schemas"]["explore_place"];
export type ExploreRecommendation = components["schemas"]["explore_recommendation"];

export async function getDestinations(): Promise<AreaCard[]> {
  await connection();
  const { data, error } = await serverApiClient().GET("/api/v1/areas");
  if (error || !data) throw new Error("Couldn't load destinations");
  return data;
}

export async function getActivities(): Promise<Activity[]> {
  await connection();
  const { data, error } = await serverApiClient().GET("/api/v1/activities");
  if (error || !data) throw new Error("Couldn't load activities");
  return data;
}

// null when there is no such area. Cached per request: the page and its metadata share
// one call.
export const getArea = cache(async (slug: string): Promise<AreaDetail | null> => {
  await connection();
  const { data, response } = await serverApiClient().GET("/api/v1/areas/{slug}", { params: { path: { slug } } });
  if (response.status === 404) return null;
  if (!data) throw new Error("Couldn't load this destination");
  return data;
});

// One active listing (RAA-86). null for a draft, pending or unknown one. Cached per request:
// the page and its metadata share one call.
export const getListing = cache(async (id: number): Promise<ListingDetail | null> => {
  await connection();
  const { data, response } = await serverApiClient().GET("/api/v1/listings/{id}", { params: { path: { id } } });
  if (response.status === 404) return null;
  if (!data) throw new Error("Couldn't load this listing");
  return data;
});

// What surrounds one destination (RAA-58): nearby destinations and the ones often visited
// with it. null when there is no such area or published landmark. Cached per request.
export const getExplore = cache(async (anchor: { area: string } | { landmark: string }): Promise<Explore | null> => {
  await connection();
  const { data, response } = await serverApiClient().GET("/api/v1/explore", { params: { query: anchor } });
  if (response.status === 404) return null;
  if (!data) throw new Error("Couldn't load what's around this destination");
  return data;
});

export async function search(q: string): Promise<SearchResults> {
  await connection();
  const { data, error } = await serverApiClient().GET("/api/v1/search", { params: { query: { q } } });
  if (error || !data) throw new Error("Search failed");
  return data;
}
