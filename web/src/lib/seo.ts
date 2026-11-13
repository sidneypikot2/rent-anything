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

// A title as a URL slug (RAA-236): ASCII letters and digits in lowercase joined by single
// hyphens, accents and apostrophes dropped ("Señora's Café" → "senoras-cafe"), anything else
// (emoji, other scripts) left out, cut at a word to `max` characters. Empty when nothing in the
// title survives, and the path is then the id alone. Change it and every listing's URL moves (each
// old one still 308s to the new).
export function slugify(text: string, max = 60): string {
  const slug = text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/ß/g, "ss")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (slug.length <= max) return slug;
  const cut = slug.slice(0, max);
  if (slug[max] === "-") return cut;
  const atWord = cut.slice(0, cut.lastIndexOf("-"));
  return (atWord || cut).replace(/-+$/, "");
}

// A listing's public path, `/listings/123-island-hopping-tour` (RAA-236): every link to a listing,
// its canonical and the sitemap use it. The id leads and is all the page reads (`listingId`); the
// page 308s any other slug (none, an old title) to this one, keeping the query. A caller with only
// the id gets `/listings/123`, which that redirect turns into this.
export function listingPath(listing: { id: number; title?: string | null }): string {
  const slug = listing.title ? slugify(listing.title) : "";
  return `/listings/${listing.id}${slug ? `-${slug}` : ""}`;
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

// A trail from the home page down to a page (RAA-241): the BreadcrumbList JSON-LD and the
// visible breadcrumbs (`Breadcrumbs`, RAA-237) take the same list, so they never disagree. Paths,
// made absolute where needed.
export type Crumb = { name: string; path: string };

// `ancestors` are the listed places it sits in, top-most first (`ancestorsOf`: an island over its
// town), so a town reads Home › Bantayan Island › Santa Fe.
type Place = { slug: string; name: string };

export function areaCrumbs(area: Place, ancestors: Place[] = []): Crumb[] {
  return [{ name: "Home", path: "/" }, ...[...ancestors, area].map((place) => ({ name: place.name, path: `/${place.slug}` }))];
}

export function listingCrumbs(listing: { id: number; title: string; area: Place }, ancestors: Place[] = []): Crumb[] {
  return [...areaCrumbs(listing.area, ancestors), { name: listing.title, path: listingPath(listing) }];
}
