---
paths:
  - "web/**"
---

# Web conventions (Next.js)

Next.js 16 App Router, TypeScript (strict), Tailwind CSS 4, TanStack Query. **This Next.js is newer than your training data**: before using an API you aren't sure of, read the guide under `web/node_modules/next/dist/docs/` (`web/AGENTS.md` says the same; `next dev` rewrites that file, so leave it as it is).

**Checks**: `script/check frontend` — ESLint, `tsc` (after `next typegen`, which generates the route types such as `LayoutProps`), `next build`, and the API contract. ESLint also runs on each file you edit. None of it executes the app; `script/smoke` does (`tools/smoke/tests/`). It finds elements by `data-testid`: renaming one means updating the test in the same change. Run npm commands through the scripts or `docker compose run --rm web ...` so the lockfile is resolved in the same Node as CI.

**API access**: only through `apiClient()` in `web/src/api/client.ts` (openapi-fetch, typed from `src/api/schema.d.ts`). Never `fetch` the API directly, and never edit `schema.d.ts` — change the backend's request spec and run `script/check-api --write`. Where the API is comes from `web/src/lib/config.ts`: server code uses `API_INTERNAL_URL` (inside Docker the backend is `http://backend:3000`), the browser derives it from its own port (8100+N → 3100+N).

**Server vs client**: public browse pages (`/[area]`, `/[area]/[category]`, `/listings/[id]`) are Server Components that fetch on the server, for SEO and fast first paint. Signed-in pages (cart, bookings, owner dashboard, admin) are Client Components using TanStack Query (provider in `src/app/providers.tsx`). Mark a file `"use client"` only where it needs state, effects or browser APIs, and keep server-only values (anything without `NEXT_PUBLIC_`) out of client files.

**Area first**: every traveller-facing page lives under an area (`/moalboal/...`), and the selected area and trip dates travel in the URL. The cart is per area: never show or mix another area's cart items.

**Layout**: mobile-first — most travellers book from a phone. Check every page at phone width.
