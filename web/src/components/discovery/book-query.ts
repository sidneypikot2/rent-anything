import type { PlanGroup } from "@/api/discovery";
import { filterQuery, NO_FILTERS, type Filters } from "./filters";

// One What to book section's page as the API is asked for it (GET /areas/{slug}/book_cards,
// 2026-11-10): its group, page and size, filters and the page's search. `around`: the page holding
// a listing (a link to its row); `near`: a distance search's listing ids, nearest first.
export type BookQuery = {
  group: PlanGroup;
  page: number;
  perPage: number;
  filters: Filters;
  q?: string;
  around?: number | null;
  near?: number[] | null;
};

export const PER_PAGE = 18;
// A section's rows under All, before its "Show all N".
export const FIRST_ROWS = 3;

export function apiQuery({ group, page, perPage, filters, q, around, near }: BookQuery) {
  return {
    group,
    page,
    per_page: perPage,
    ...(q ? { q } : {}),
    ...(around ? { around } : {}),
    ...(near ? { "listing_ids[]": near } : {}),
    ...filterQuery(filters),
  };
}

// The query a section's first view asks for (page 1, no filters), so the server's fetch can seed it.
export function firstQuery(group: PlanGroup, perPage: number, q?: string): BookQuery {
  return { group, page: 1, perPage, filters: NO_FILTERS, q };
}
