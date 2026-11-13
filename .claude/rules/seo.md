---
paths:
  - "web/src/app/robots.ts"
  - "web/src/app/sitemap.ts"
  - "web/src/app/layout.tsx"
  - "web/src/lib/config.ts"
  - "web/src/lib/seo.ts"
  - "web/src/lib/json-ld.ts"
  - "web/src/lib/og.tsx"
  - "web/src/components/seo/**"
  - "web/src/app/opengraph-image.tsx"
  - "web/src/app/logo.png/**"
  - "web/src/app/**/page.tsx"
  - "web/src/app/**/layout.tsx"
  - "deploy/staging/Caddyfile"
---

# SEO: the site's URL and who may index it

**Absolute URLs** come from `siteUrl()` / `absoluteUrl(path)` in `web/src/lib/config.ts` (RAA-249), reading `NEXT_PUBLIC_SITE_URL` (a build arg; default `http://localhost:8100`, no trailing slash). The root layout sets `metadataBase` from it, so a page's canonical or Open Graph image can be a relative path. Never build the site's origin from the request's `Host` or `window.location` for SEO output: a proxy or a worktree port would end up in the index.

**Indexing is a flag, not a hostname** (RAA-247): `siteIndexable()` is true only when the build had `NEXT_PUBLIC_SITE_INDEXABLE=true`, which only production will set. Anything else — staging (`false`, in `deploy-staging.yml`), local stacks and CI (unset) — gets `Disallow: /` in `robots.ts` and `noindex, nofollow` on every page from the root layout, and staging's `Caddyfile` adds `X-Robots-Tag` on both hosts. A page that must never be indexed (a token link, the admin console) still sets its own `robots: { index: false }`, since production turns the layout's off.

**robots.txt** (`src/app/robots.ts`, RAA-244) keeps crawlers out of the signed-in, partner and admin pages; a new private top-level route joins its `disallow` list. **sitemap.xml** (`src/app/sitemap.ts`, RAA-232) lists the public static pages, every area and every active listing, read from the API per request (`connection()`); a new public page joins `STATIC_PATHS`.

**A missing page answers 404** (RAA-246), not a 200 with a "not found" page (a soft 404). A `notFound()` under a `loading.tsx` comes after the skeleton has sent the 200, so a route with a skeleton checks its record in a `layout.tsx` above it: the place (`[area]/(place)/layout.tsx`), a What to book group (`book/[group]/layout.tsx`) and the plan's place (`plan/[area]/layout.tsx`). A `loading.tsx` also wraps every segment below it, so a parent's skeleton goes in a route group beside its page (`(place)/(guide)/`, `book/(all)/`), not over a child that checks its own record. A new route with a skeleton and a record to look up does the same. The smoke test "one h1 per page" lists the missing paths it checks for 404.

**No broken links** (RAA-234): the smoke test "no broken links" crawls same-origin links in the server's HTML from the home page (a bounded number of pages and of each URL shape) and fails on any that answers 400 or more. External links (`SOCIALS`, the address form's sources) aren't checked in CI; check them by hand when one changes.

**Every page decides its metadata** (`web/src/lib/seo.ts`, RAA-227, RAA-228, RAA-229, RAA-238). Metadata merges shallowly from the root down, so a key a page leaves out comes from its layout:
- **Private pages** set `robots: NOINDEX`: the signed-in guest pages and the partner console from their layouts (`(guest)/(signed-in)/layout.tsx`, `partner/(protected)/layout.tsx`), sign-in, sign-up, code and forgot-password pages (guest and partner), token links, `/nearby` (a test page, RAA-248: kept up, noindex, never in the sitemap or linked) and the plan's review (one guest's trip). A new private page goes under one of those layouts or sets it itself; a new private top-level route also joins `robots.ts`' `disallow`.
- **Public pages** set a `description` of their own (aim for 120–160 characters, cut with `metaDescription()`; a page built from data has a fallback for an empty field, never the root's) and `alternates: canonical(path)` — the path alone, never the query (dates, filters, `?trip=`, tracking), made absolute by `metadataBase`. Never set `alternates` in a layout: every page under it would inherit that canonical. `/search` keeps one canonical and is `noindex, follow` with a `?q=`.
- **Titles** are short and say what the page is ("What to book on <place>", "<place> <year>: places to see, stays and tours"); the root template adds ` · <BRAND>`, so keep a page's own part under about 47 characters (a listing adds its place or kind only while it fits, `listingTitle`). The brand comes from `brand.ts`, never typed out.
- **A listing's URL** is `listingPath()` everywhere SEO needs it (canonical, sitemap), so the move to slugs (RAA-236) changes only that helper.

**Shared links** (Open Graph and Twitter, RAA-233): the root layout sets `OPEN_GRAPH` (site name, `website`, `en_PH`) and `twitter: summary_large_image`; og:title and og:description are never written — Next fills them from the page's own title and description. The default image is `web/src/app/opengraph-image.tsx`. A page with its own photo or URL sets `openGraph: openGraph(path, image)` (`seo.ts`): metadata merges shallowly, so a page's `openGraph` replaces the layout's whole, and the helper puts the shared fields and the default image back. An area shares its first own photo, a listing its cover — never a sample photo. In `next dev` the default image's URL uses the dev server's own port (Next's fallback for file-based images); a build uses `metadataBase`.

**Images made with next/og** (`web/src/app/opengraph-image.tsx`, `/logo.png`) draw from `web/src/lib/og.tsx`: next/og can't read `globals.css`, so the Sky & Forest colours it uses are mirrored there (`OG_PALETTE`, each with its token's name) — change a token, change it there too. Its font is Plus Jakarta Sans from `web/src/assets/fonts/` (OFL, the licence beside it), read at build time; keep both images static (no request data), since the standalone server has no `src/`.

**Structured data** (JSON-LD, RAA-241): built in `web/src/lib/json-ld.ts`, rendered on the server by `<JsonLd nodes>` (`web/src/components/seo/json-ld.tsx`) as one `@graph` — never a `<script type="application/ld+json">` of a page's own, as `jsonLdText` escapes `<`, `>`, `&` and U+2028/9 so text from the API can't close the script. Every URL is absolute (`absoluteUrl`). The home has `Organization` (brand, `/logo.png`, `SOCIALS`) and `WebSite` with a `SearchAction` to `/search?q=`; an area `TouristDestination` (its centre, its own photos); a listing a `Product` with an `Offer` (from-price in PHP, sold by its business) once priced, else a `Service` its business provides; an area and a listing a `BreadcrumbList`. Breadcrumbs come from `areaCrumbs` / `listingCrumbs` (`seo.ts`), the list the visible breadcrumbs (RAA-237) are to use too.
