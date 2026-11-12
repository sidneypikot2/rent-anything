import type { Metadata } from "next";
import { BRAND, TAGLINE } from "@/lib/brand";

// Page metadata helpers (RAA-227, RAA-229, RAA-238). Conventions in .claude/rules/seo.md.

// A page search engines must never list: signed-in, partner console, sign-in and sign-up pages
// and token links. Set on the page or its layout, it holds in production too, where the root
// layout's own noindex is off (siteIndexable()).
export const NOINDEX: Metadata["robots"] = { index: false, follow: false };

// The canonical link for a public page: its path without the query (trip dates, filters,
// tracking), made absolute by the root layout's metadataBase (siteUrl()).
export function canonical(path: string): Metadata["alternates"] {
  return { canonical: path };
}

// A listing's public path, the one canonical and the sitemap use. Listing URLs are ids for now;
// slugs (RAA-236) change only this.
export function listingPath(listing: { id: number }): string {
  return `/listings/${listing.id}`;
}

// A meta description cut to what a search result shows (about 160 characters), at a word.
export function metaDescription(text: string, max = 160): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const atWord = cut.slice(0, cut.lastIndexOf(" "));
  return `${(atWord || cut).replace(/[\s,.;:–-]+$/, "")}…`;
}

// Open Graph (RAA-233). The root layout sets these for every page and the default share image
// (app/opengraph-image.tsx); og:title and og:description follow each page's own title and
// description, so a page never writes them twice. A page with its own image or URL sets
// `openGraph(path, image)`: metadata merges shallowly, so its openGraph replaces the layout's
// whole, and this keeps the shared fields and the default image with it.
export const OPEN_GRAPH = { siteName: BRAND, type: "website", locale: "en_PH" } as const;
export const DEFAULT_OG_IMAGE = { url: "/opengraph-image", width: 1200, height: 630, alt: `${BRAND}: ${TAGLINE}` };

export function openGraph(path: string, image?: { url: string; alt: string } | null): Metadata["openGraph"] {
  return { ...OPEN_GRAPH, url: path, images: [image ?? DEFAULT_OG_IMAGE] };
}

// A trail from the home page down to a page (RAA-241): the BreadcrumbList JSON-LD now, the
// visible breadcrumbs later (RAA-237), from the same list. Paths, made absolute where needed.
export type Crumb = { name: string; path: string };

export function areaCrumbs(area: { slug: string; name: string }): Crumb[] {
  return [
    { name: "Home", path: "/" },
    { name: area.name, path: `/${area.slug}` },
  ];
}

export function listingCrumbs(listing: { id: number; title: string; area: { slug: string; name: string } }): Crumb[] {
  return [...areaCrumbs(listing.area), { name: listing.title, path: listingPath(listing) }];
}
