import { connection } from "next/server";
import { cache } from "react";
import { serverApiClient } from "./server-client";
import type { components, paths } from "./schema";

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
export type GroupCounts = components["schemas"]["group_counts"];
export type MapPinsPage = components["schemas"]["map_pins"];

// Cached per request: the home page's hero card and its sections share one fetch (RAA-125).
export const getDestinations = cache(async (): Promise<AreaCard[]> => {
  await connection();
  const { data, error } = await serverApiClient().GET("/api/v1/areas");
  if (error || !data) throw new Error("Couldn't load destinations");
  return data;
});

export const getActivities = cache(async (): Promise<Activity[]> => {
  await connection();
  const { data, error } = await serverApiClient().GET("/api/v1/activities");
  if (error || !data) throw new Error("Couldn't load activities");
  return data;
});

// A place: its places to see, the places inside it and what it offers per group (the plan pages,
// What to book and the place's page, which page through its listings). null when there is no such area.
export const getAreaPlaces = cache(async (slug: string): Promise<AreaDetail | null> => {
  await connection();
  const { data, response } = await serverApiClient().GET("/api/v1/areas/{slug}", { params: { path: { slug } } });
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
  // `facets: false` for a row that shows no filter sheet (the place's page).
  async (slug: string, group: PlanGroup, perPage: number, q?: string, from?: string, to?: string, page = 1, facets = true): Promise<BookCardsPage | null> => {
    await connection();
    const { data, response } = await serverApiClient().GET("/api/v1/areas/{slug}/book_cards", {
      params: {
        path: { slug },
        // The section chips' counts come from getBookCounts, once for the page.
        query: {
          group,
          per_page: perPage,
          page,
          counts: false,
          ...(q ? { q } : {}),
          ...(from && to ? { from, to } : {}),
          ...(facets ? {} : { facets: false }),
        },
      },
    });
    if (response.status === 404) return null;
    if (!data) throw new Error("Couldn't load what to book here");
    return data;
  },
);

// How many cards each What to book section has, with the page's search and dates: its section
// chips, asked once for the page rather than with every section's cards. null for an unknown place.
export const getBookCounts = cache(async (slug: string, q?: string, from?: string, to?: string): Promise<GroupCounts | null> => {
  await connection();
  const { data, response } = await serverApiClient().GET("/api/v1/areas/{slug}/book_counts", {
    params: { path: { slug }, query: { ...(q ? { q } : {}), ...(from && to ? { from, to } : {}) } },
  });
  if (response.status === 404) return null;
  if (!data) throw new Error("Couldn't count what to book here");
  return data.counts;
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
