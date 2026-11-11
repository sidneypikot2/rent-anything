import type { BookCardsPage, GroupCounts, PlanGroup } from "@/api/discovery";
import { filterQuery, NO_FILTERS, type Filters } from "./filters";

// One What to book section's page as the API is asked for it (GET /areas/{slug}/book_cards,
// 2026-11-10): its group, page and size, filters and the page's search. `around`: the page holding
// a listing (a link to its row); `near`: a distance search's listing ids, nearest first; `from` /
// `to`: the dates picked on the page, which keep only what is free on them. `facets: false`: a
// row's later page, which shows no filter sheet, skips its counts.
export type BookQuery = {
  group: PlanGroup;
  page: number;
  perPage: number;
  filters: Filters;
  q?: string;
  around?: number | null;
  near?: number[] | null;
  from?: string;
  to?: string;
  facets?: false;
};

// What to book's sideways rows show 3 cards and load 6 at a time, two views of 3 (2026-11-11);
// its Show all page 10 a page.
export const ROW_SIZE = 6;
export const LIST_PAGE = 10;

// The page's search and dates, all the section chips' counts depend on.
export type BookSearch = { q?: string; from?: string; to?: string };

// What the server fetched for What to book's first paint: the sections' first pages and the
// section chips' counts for `search` (null when they couldn't be had: the browser asks again).
export type BookSeed = { pages: { query: BookQuery; data: BookCardsPage }[]; counts: GroupCounts | null; search: BookSearch };

// The section chips' counts as the API is asked for them (GET /areas/{slug}/book_counts): only
// the search and dates matter, so switching sections or filtering never asks again.
export function countsQuery({ q, from, to }: BookSearch) {
  return { ...(q ? { q } : {}), ...(from && to ? { from, to } : {}) };
}

export function apiQuery({ group, page, perPage, filters, q, around, near, from, to, facets }: BookQuery) {
  return {
    group,
    page,
    per_page: perPage,
    // The section chips' counts come from book_counts, once for the page (countsQuery).
    counts: false as const,
    ...(q ? { q } : {}),
    ...(from && to ? { from, to } : {}),
    ...(around ? { around } : {}),
    ...(near ? { "listing_ids[]": near } : {}),
    ...(facets === false ? { facets: false } : {}),
    ...filterQuery(filters),
  };
}

// The query a section's first view asks for (no filters), so the server's fetch can seed it.
export function firstQuery(group: PlanGroup, perPage: number, q?: string, dates?: { from?: string; to?: string }, page = 1): BookQuery {
  return { group, page, perPage, filters: NO_FILTERS, q, ...(dates?.from && dates.to ? { from: dates.from, to: dates.to } : {}) };
}
