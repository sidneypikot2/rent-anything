import type { AreaDetail, ListingDetail } from "@/api/discovery";
import { BRAND, SOCIALS, SUPPORT_EMAIL, TAGLINE } from "@/lib/brand";
import { absoluteUrl, siteUrl } from "@/lib/config";
import { fromCents } from "@/lib/money";
import { type Crumb, listingPath } from "@/lib/seo";

// schema.org structured data (RAA-241), rendered on the server by <JsonLd>
// (components/seo/json-ld.tsx). Every URL is absolute, from NEXT_PUBLIC_SITE_URL (siteUrl()).
// Conventions in .claude/rules/seo.md.
export type JsonLdNode = Record<string, unknown>;

const ORGANIZATION_ID = `${siteUrl()}/#organization`;

// Who runs the site, on the home page: the name, the logo (app/logo.png) and our social accounts.
export function organizationJsonLd(): JsonLdNode {
  return {
    "@type": "Organization",
    "@id": ORGANIZATION_ID,
    name: BRAND,
    url: absoluteUrl("/"),
    logo: absoluteUrl("/logo.png"),
    email: SUPPORT_EMAIL,
    sameAs: Object.values(SOCIALS),
  };
}

// The site, with its search (/search?q=) for a sitelinks search box.
export function webSiteJsonLd(): JsonLdNode {
  return {
    "@type": "WebSite",
    name: BRAND,
    description: TAGLINE,
    url: absoluteUrl("/"),
    publisher: { "@id": ORGANIZATION_ID },
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${absoluteUrl("/search")}?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };
}

// A destination's page: the place, where it is, and its own photos (never a sample photo).
export function placeJsonLd(detail: AreaDetail): JsonLdNode {
  const { area, center, guide, photos } = detail;
  const description = guide.description ?? guide.tagline;
  return {
    "@type": ["TouristDestination", "Place"],
    name: area.name,
    url: absoluteUrl(`/${area.slug}`),
    ...(description ? { description } : {}),
    geo: { "@type": "GeoCoordinates", latitude: center.lat, longitude: center.lng },
    ...(photos.length > 0 ? { image: photos.map((photo) => photo.large_url) } : {}),
    ...(area.parent_name ? { containedInPlace: { "@type": "Place", name: area.parent_name } } : {}),
  };
}

// A listing. With a price it is a Product with an Offer (its from-price in PHP, sold by its
// business), which search engines can show with the price; with none yet, a Service its
// business provides, since a Product without an offer is invalid to Google.
export function listingJsonLd(listing: ListingDetail): JsonLdNode {
  const { title, summary, description, photos, business, category, price_from_cents } = listing;
  const url = absoluteUrl(listingPath(listing));
  const seller = { "@type": "Organization", name: business.name, url: absoluteUrl(`/businesses/${business.id}`) };
  const common = {
    name: title,
    url,
    category: category.name,
    ...(description || summary ? { description: description || summary } : {}),
    ...(photos.length > 0 ? { image: photos.map((photo) => photo.large_url) } : {}),
  };
  if (price_from_cents === null) return { "@type": "Service", ...common, provider: seller };
  return {
    "@type": "Product",
    ...common,
    offers: {
      "@type": "Offer",
      url,
      price: fromCents(price_from_cents),
      priceCurrency: "PHP",
      availability: "https://schema.org/InStock",
      seller,
    },
  };
}

// Home › Area › Listing, from the same crumbs the visible breadcrumbs will use (RAA-237).
export function breadcrumbJsonLd(crumbs: Crumb[]): JsonLdNode {
  return {
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: absoluteUrl(crumb.path),
    })),
  };
}

// The script's text: one @graph, with every character that could end the <script> or break
// it as JavaScript escaped (a partner's listing text is in here).
export function jsonLdText(nodes: JsonLdNode[]): string {
  return JSON.stringify({ "@context": "https://schema.org", "@graph": nodes })
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
