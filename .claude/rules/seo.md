---
paths:
  - "web/src/app/robots.ts"
  - "web/src/app/sitemap.ts"
  - "web/src/app/layout.tsx"
  - "web/src/lib/config.ts"
  - "deploy/staging/Caddyfile"
---

# SEO: the site's URL and who may index it

**Absolute URLs** come from `siteUrl()` / `absoluteUrl(path)` in `web/src/lib/config.ts` (RAA-249), reading `NEXT_PUBLIC_SITE_URL` (a build arg; default `http://localhost:8100`, no trailing slash). The root layout sets `metadataBase` from it, so a page's canonical or Open Graph image can be a relative path. Never build the site's origin from the request's `Host` or `window.location` for SEO output: a proxy or a worktree port would end up in the index.

**Indexing is a flag, not a hostname** (RAA-247): `siteIndexable()` is true only when the build had `NEXT_PUBLIC_SITE_INDEXABLE=true`, which only production will set. Anything else — staging (`false`, in `deploy-staging.yml`), local stacks and CI (unset) — gets `Disallow: /` in `robots.ts` and `noindex, nofollow` on every page from the root layout, and staging's `Caddyfile` adds `X-Robots-Tag` on both hosts. A page that must never be indexed (a token link, the admin console) still sets its own `robots: { index: false }`, since production turns the layout's off.

**robots.txt** (`src/app/robots.ts`, RAA-244) keeps crawlers out of the signed-in, partner and admin pages; a new private top-level route joins its `disallow` list. **sitemap.xml** (`src/app/sitemap.ts`, RAA-232) lists the public static pages, every area and every active listing, read from the API per request (`connection()`); a new public page joins `STATIC_PATHS`.
