"use client";

import { useQuery, type QueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import type { BookCardsPage, GroupCounts } from "@/api/discovery";
import { apiQuery, countsQuery, type BookQuery, type BookSearch, type BookSeed } from "./book-query";

// A What to book section's page from the API. While another page of it loads, the section's last
// page stays on screen (`client`'s cache: useQueries starts a new observer per key, so
// keepPreviousData has nothing to keep). `initial`: a page the server fetched, used when the query
// is the same.
export function bookCardsOptions(
  slug: string,
  query: BookQuery,
  initial?: { query: BookQuery; data: BookCardsPage },
  client?: QueryClient,
) {
  const params = apiQuery(query);
  const same = initial && JSON.stringify(apiQuery(initial.query)) === JSON.stringify(params);
  return {
    queryKey: ["book-cards", slug, params],
    queryFn: async () => {
      const { data, error } = await apiClient().GET("/api/v1/areas/{slug}/book_cards", { params: { path: { slug }, query: params } });
      if (error || !data) throw new Error("Couldn't load these just now");
      return data;
    },
    placeholderData: (previous: BookCardsPage | undefined) => previous ?? (client && lastPage(client, slug, query.group)),
    staleTime: 60_000,
    initialData: same ? initial.data : undefined,
  };
}

// The section chips' counts for the page's search and dates. While new dates' counts load, the
// last ones stay. `seed`: what the server fetched, used when its search and dates are the same.
export function bookCountsOptions(slug: string, search: BookSearch, seed?: BookSeed) {
  const params = countsQuery(search);
  const initial = seed?.counts && JSON.stringify(countsQuery(seed.search)) === JSON.stringify(params) ? seed.counts : undefined;
  return {
    queryKey: ["book-counts", slug, params],
    queryFn: async () => {
      const { data, error } = await apiClient().GET("/api/v1/areas/{slug}/book_counts", { params: { path: { slug }, query: params } });
      if (error || !data) throw new Error("Couldn't count these just now");
      return data.counts;
    },
    placeholderData: (previous: GroupCounts | undefined) => previous,
    staleTime: 60_000,
    initialData: initial,
  };
}

// The section's most recently fetched page, any query.
function lastPage(client: QueryClient, slug: string, group: string) {
  return client
    .getQueryCache()
    .findAll({ queryKey: ["book-cards", slug] })
    .filter((query) => (query.queryKey[2] as { group?: string }).group === group && query.state.data)
    .sort((a, b) => b.state.dataUpdatedAt - a.state.dataUpdatedAt)[0]?.state.data as BookCardsPage | undefined;
}

// One section's page, as the filter sheet counts its draft.
export function useBookCards(slug: string, query: BookQuery, enabled = true) {
  return useQuery({ ...bookCardsOptions(slug, query), enabled });
}
