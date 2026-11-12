// Every list endpoint answers a page at a time (the API's Paginated concern: 50 unless asked,
// at most 200), with the total in X-Total-Count. A list the screen needs whole — the
// destinations, a guest's trips, a partner's listings — comes through allPages, which asks
// for the biggest pages and follows the total. MAX_PAGES caps it, so a runaway list can't
// keep the page fetching.

export const MAX_PER_PAGE = 200;
const MAX_PAGES = 10;

export type PageQuery = { page: number; per_page: number };

type ListResult = { data?: readonly unknown[]; error?: unknown; response: Response };

// Calls fetchPage for page 1, then each further page the total needs, and answers the first
// page's result with every page's rows in `data` — or the first page that failed, as it came.
export async function allPages<R extends ListResult>(fetchPage: (query: PageQuery) => Promise<R>): Promise<R> {
  const first = await fetchPage({ page: 1, per_page: MAX_PER_PAGE });
  if (!first.data) return first;

  const total = Number(first.response.headers.get("X-Total-Count") ?? first.data.length);
  const pages = Math.min(Math.ceil(total / MAX_PER_PAGE), MAX_PAGES);
  let rows: unknown[] = [...first.data];
  for (let page = 2; page <= pages; page++) {
    const next = await fetchPage({ page, per_page: MAX_PER_PAGE });
    if (!next.data) return next;
    rows = rows.concat(next.data);
  }
  return { ...first, data: rows as R["data"] };
}
