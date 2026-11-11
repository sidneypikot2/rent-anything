import { connection } from "next/server";
import { cache } from "react";
import { serverApiClient } from "./server-client";
import type { components, paths } from "./schema";
import { allPages } from "@/api/pages";

// Guest discovery (RAA-33): destinations, activities, one area, and search. These run in
// Server Components; connection() keeps them out of the build-time prerender, so the
// pages always show the current data and `next build` never needs the API.

export type AreaCard = components["schemas"]["area_card"];
export type AreaDetail = components["schemas"]["area_detail"];
export type ListingDetail = components["schemas"]["listing_detail"];
export type BusinessDetail = components["schemas"]["business_detail"];
export type Activity = components["schemas"]["activity"];
export type SearchResults = components["schemas"]["search_results"];
export type Explore = components["schemas"]["explore"];
export type ExploreListing = components["schemas"]["explore_listing"];
export type ExplorePlace = components["schemas"]["explore_place"];
export type ExploreRecommendation = components["schemas"]["explore_recommendation"];
export type StayQuote = components["schemas"]["stay_quote"];
export type PlanBusinessesPage = components["schemas"]["plan_businesses"];
export type PlanGroup = keyof PlanBusinessesPage["counts"];
export type BookCardsPage = components["schemas"]["book_cards"];

// Cached per request: the home page's hero card and its sections share one fetch (RAA-125).
export const getDestinations = cache(async (): Promise<AreaCard[]> => {
  await connection();
  const { data, error } = await allPages((query) => serverApiClient().GET("/api/v1/areas", { params: { query } }));
  if (error || !data) throw new Error("Couldn't load destinations");
  return data;
});

export const getActivities = cache(async (): Promise<Activity[]> => {
  await connection();
  const { data, error } = await allPages((query) => serverApiClient().GET("/api/v1/activities", { params: { query } }));
  if (error || !data) throw new Error("Couldn't load activities");
  return data;
});

// null when there is no such area. Cached per request: the page and its metadata share
// one call.
export const getArea = cache(async (slug: string): Promise<AreaDetail | null> => {
  await connection();
  const { data, response } = await serverApiClient().GET("/api/v1/areas/{slug}", { params: { path: { slug } } });
  if (response.status === 404) return null;
  if (!data) throw new Error("Couldn't load this destination");
  return data;
});

// A place for the plan pages: its places to see and the places inside it, without its listings
// (a step pages through those, getPlanBusinesses). null when there is no such area.
export const getAreaPlaces = cache(async (slug: string): Promise<AreaDetail | null> => {
  await connection();
  const { data, response } = await serverApiClient().GET("/api/v1/areas/{slug}", { params: { path: { slug }, query: { listings: "0" } } });
  if (response.status === 404) return null;
  if (!data) throw new Error("Couldn't load this destination");
  return data;
});

// Page 1 of the businesses offering one plan step in a place, with every group's count. null for an
// unknown place.
export const getPlanBusinesses = cache(async (slug: string, group: PlanGroup): Promise<PlanBusinessesPage | null> => {
  await connection();
  const { data, response } = await serverApiClient().GET("/api/v1/areas/{slug}/plan_businesses", {
    params: { path: { slug }, query: { group } },
  });
  if (response.status === 404) return null;
  if (!data) throw new Error("Couldn't load what to book here");
  return data;
});

// The first page of one What to book section's cards (`perPage` of them: All shows 3), with the
// page's search. null for an unknown place.
export const getBookCards = cache(
  async (slug: string, group: PlanGroup, perPage: number, q?: string): Promise<BookCardsPage | null> => {
    await connection();
    const { data, response } = await serverApiClient().GET("/api/v1/areas/{slug}/book_cards", {
      params: { path: { slug }, query: { group, per_page: perPage, ...(q ? { q } : {}) } },
    });
    if (response.status === 404) return null;
    if (!data) throw new Error("Couldn't load what to book here");
    return data;
  },
);

// One active listing (RAA-86). null for a draft, pending or unknown one. Cached per request:
// the page and its metadata share one call.
export const getListing = cache(async (id: number): Promise<ListingDetail | null> => {
  await connection();
  const { data, response } = await serverApiClient().GET("/api/v1/listings/{id}", { params: { path: { id } } });
  if (response.status === 404) return null;
  if (!data) throw new Error("Couldn't load this listing");
  return data;
});

// One business's page: about it and its listings. null for an unknown one, or one with nothing
// to book. Cached per request: the page and its metadata share one call.
export const getBusiness = cache(async (id: number): Promise<BusinessDetail | null> => {
  await connection();
  const { data, response } = await serverApiClient().GET("/api/v1/businesses/{id}", { params: { path: { id } } });
  if (response.status === 404) return null;
  if (!data) throw new Error("Couldn't load this business");
  return data;
});

// What surrounds one destination (RAA-58): nearby destinations and the ones often visited
// with it. null when there is no such area or published landmark. Cached per request.
// `listings: "0"` leaves the listings out (the plan pages need only the anchor and the places).
export const getExplore = cache(async (anchor: { area: string; listings?: "0" } | { landmark: string }): Promise<Explore | null> => {
  await connection();
  const { data, response } = await serverApiClient().GET("/api/v1/explore", { params: { query: anchor } });
  if (response.status === 404) return null;
  if (!data) throw new Error("Couldn't load what's around this destination");
  return data;
});

// What a stay costs (RAA-105): the quote, or the API's reasons it can't be quoted for these
// dates and guests ("This place needs a stay of at least 2 nights").
export async function getQuote(
  query: paths["/api/v1/quotes"]["get"]["parameters"]["query"],
): Promise<{ quote: StayQuote } | { errors: string[] }> {
  await connection();
  const { data, error, response } = await serverApiClient().GET("/api/v1/quotes", { params: { query } });
  if (data) return { quote: data };
  if (response.status === 422 && error && "errors" in error) return { errors: error.errors };
  // The page still shows without a total.
  return { errors: ["Couldn't work out the price just now. Try again in a moment."] };
}

export async function search(q: string): Promise<SearchResults> {
  await connection();
  const { data, error } = await serverApiClient().GET("/api/v1/search", { params: { query: { q } } });
  if (error || !data) throw new Error("Search failed");
  return data;
}
