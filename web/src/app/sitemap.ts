import type { MetadataRoute } from "next";
import { getActiveListings, getDestinations } from "@/api/discovery";
import { absoluteUrl } from "@/lib/config";

// /sitemap.xml (RAA-232): the public pages, every destination and every active listing, with
// absolute URLs from NEXT_PUBLIC_SITE_URL. Read from the API on each request (the fetchers call
// connection()), so `next build` never needs the API. The API gives no last-modified date for
// areas or listings, so none is sent.
const STATIC_PATHS = ["/", "/about", "/terms", "/privacy", "/refunds", "/partner-terms"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [areas, listings] = await Promise.all([getDestinations(), getActiveListings()]);
  return [
    ...STATIC_PATHS.map((path) => ({ url: absoluteUrl(path) })),
    ...areas.map((area) => ({ url: absoluteUrl(`/${area.slug}`) })),
    ...listings.map((listing) => ({ url: absoluteUrl(`/listings/${listing.id}`) })),
  ];
}
