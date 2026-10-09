---
paths:
  - "web/**"
---

# Web conventions (Next.js)

Next.js 16 App Router, TypeScript (strict), Tailwind CSS 4, TanStack Query. **This Next.js is newer than your training data**: before using an API you aren't sure of, read the guide under `web/node_modules/next/dist/docs/` (`web/AGENTS.md` says the same; `next dev` rewrites that file, so leave it as it is).

**Checks**: `script/check frontend` — ESLint, `tsc` (after `next typegen`, which generates the route types such as `LayoutProps`), `next build`, and the API contract. ESLint also runs on each file you edit. None of it executes the app; `script/smoke` does (`tools/smoke/tests/`). It finds elements by `data-testid`: renaming one means updating the test in the same change. Run npm commands through the scripts or `docker compose run --rm web ...` so the lockfile is resolved in the same Node as CI.

**API access**: only through `apiClient()` in `web/src/api/client.ts` (openapi-fetch, typed from `src/api/schema.d.ts`), or, in a Server Component calling a public endpoint, `serverApiClient()` in `web/src/api/server-client.ts` — `apiClient()` imports the browser-only auth session and breaks the server build. Server fetchers call `connection()` first (`src/api/discovery.ts`) so `next build` doesn't prerender against the API. Never `fetch` the API directly, and never edit `schema.d.ts` — change the backend's request spec and run `script/check-api --write`. Where the API is comes from `web/src/lib/config.ts`: server code uses `API_INTERNAL_URL` (inside Docker the backend is `http://backend:3000`), the browser derives it from its own port (8100+N → 3100+N).

**Server vs client**: public browse pages (`/[area]`, `/[area]/[category]`, `/listings/[id]`) are Server Components that fetch on the server, for SEO and fast first paint. Signed-in pages (cart, bookings, partner dashboard, admin) are Client Components using TanStack Query (provider in `src/app/providers.tsx`). Mark a file `"use client"` only where it needs state, effects or browser APIs, and keep server-only values (anything without `NEXT_PUBLIC_`) out of client files.

**Three sections**: guest pages are in the `src/app/(guest)/` route group, partner pages under `src/app/partner/`, admin pages under `src/app/admin/`, each with its own layout and `SectionHeader` (`src/components/landing/`). A sign-up on `/register` makes a guest and one on `/partner/register` a partner; `/admin` has no sign-up. Every other `/partner` page is partner-only (`auth.md`). Area pages are `/[area]` at the top level, so an area slug can never be a top-level route: `Area::RESERVED_SLUGS` (`partner`, `admin`, `search`, `login`, `register`, `dashboard`, `profile`, `settings`, `nearby`) — a new top-level guest route goes on that list too.

**Area first**: every traveller-facing page lives under an area (`/moalboal/...`), and the selected area and trip dates travel in the URL. The cart is a list of the guest's trips, which can span areas (`.claude/rules/trips.md`). A destination page's trip dates and guests are `?from=&to=&guests=` (`readTripDates` in `src/components/trips/trip-dates.ts`, which drops past or broken values).

**Add to trip** (RAA-66, `src/components/trips/`): `TripAddProvider` runs the flow for the listings inside it. Signed out, the add is saved to `sessionStorage` with its page and the sign-in sheet opens; once the session is a guest's, the provider finishes the add on that page, whether sign-in happened in the sheet or through `/register?next=`. With no current trips (`deletes_on` null) the add creates one; otherwise the which-trip sheet asks, preselecting `GET /trips/suggestion`. Which trip to suggest, trip names and date extension are the server's — don't compute them in the browser.

**Layout**: mobile-first — most travellers book from a phone. Check every page at phone width.
