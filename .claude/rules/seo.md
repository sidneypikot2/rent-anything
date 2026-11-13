---
paths:
  - "web/src/app/robots.ts"
  - "web/src/app/sitemap.ts"
  - "web/src/app/layout.tsx"
  - "web/src/lib/config.ts"
  - "web/src/lib/seo.ts"
  - "web/src/app/**/page.tsx"
  - "web/src/app/**/layout.tsx"
  - "deploy/staging/Caddyfile"
---

# SEO: the site's URL and who may index it

**Absolute URLs** come from `siteUrl()` / `absoluteUrl(path)` in `web/src/lib/config.ts` (RAA-249), reading `NEXT_PUBLIC_SITE_URL` (a build arg; default `http://localhost:8100`, no trailing slash). The root layout sets `metadataBase` from it, so a page's canonical or Open Graph image can be a relative path. Never build the site's origin from the request's `Host` or `window.location` for SEO output: a proxy or a worktree port would end up in the index.

**Indexing is a flag, not a hostname** (RAA-247): `siteIndexable()` is true only when the build had `NEXT_PUBLIC_SITE_INDEXABLE=true`, which only production will set. Anything else — staging (`false`, in `deploy-staging.yml`), local stacks and CI (unset) — gets `Disallow: /` in `robots.ts` and `noindex, nofollow` on every page from the root layout, and staging's `Caddyfile` adds `X-Robots-Tag` on both hosts. A page that must never be indexed (a token link, the admin console) still sets its own `robots: { index: false }`, since production turns the layout's off.

**robots.txt** (`src/app/robots.ts`, RAA-244) keeps crawlers out of the signed-in, partner and admin pages; a new private top-level route joins its `disallow` list. **sitemap.xml** (`src/app/sitemap.ts`, RAA-232) lists the public static pages, every area and every active listing, read from the API per request (`connection()`); a new public page joins `STATIC_PATHS`.

**Every page decides its metadata** (`web/src/lib/seo.ts`, RAA-227, RAA-228, RAA-229, RAA-238). Metadata merges shallowly from the root down, so a key a page leaves out comes from its layout:
- **Private pages** set `robots: NOINDEX`: the signed-in guest pages and the partner console from their layouts (`(guest)/(signed-in)/layout.tsx`, `partner/(protected)/layout.tsx`), sign-in, sign-up, code and forgot-password pages (guest and partner), token links, `/nearby` (a test page, RAA-248) and the plan's review (one guest's trip). A new private page goes under one of those layouts or sets it itself; a new private top-level route also joins `robots.ts`' `disallow`.
- **Public pages** set a `description` of their own (aim for 120–160 characters, cut with `metaDescription()`; a page built from data has a fallback for an empty field, never the root's) and `alternates: canonical(path)` — the path alone, never the query (dates, filters, `?trip=`, tracking), made absolute by `metadataBase`. Never set `alternates` in a layout: every page under it would inherit that canonical. `/search` keeps one canonical and is `noindex, follow` with a `?q=`.
- **Titles** are short and say what the page is ("What to book on <place>", "<place> <year>: places to see, stays and tours"); the root template adds ` · <BRAND>`, so keep a page's own part under about 47 characters (a listing adds its place or kind only while it fits, `listingTitle`). The brand comes from `brand.ts`, never typed out.
- **A listing's URL** is `listingPath()` everywhere SEO needs it (canonical, sitemap), so the move to slugs (RAA-236) changes only that helper.
