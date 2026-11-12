import type { Metadata } from "next";

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
