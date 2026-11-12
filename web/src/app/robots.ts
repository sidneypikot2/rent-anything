import type { MetadataRoute } from "next";
import { absoluteUrl, siteIndexable } from "@/lib/config";

// /robots.txt (RAA-244). Built at build time from NEXT_PUBLIC_SITE_INDEXABLE (src/lib/config.ts):
// a deployment that isn't indexable (staging, local stacks) disallows everything (RAA-247).
// Production keeps crawlers out of the signed-in, partner and admin pages; /partner/ with its
// slash leaves /partner-terms (and the partner landing page, /partner) open.
export default function robots(): MetadataRoute.Robots {
  if (!siteIndexable()) return { rules: { userAgent: "*", disallow: "/" } };

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/partner/", "/cart", "/dashboard", "/profile", "/settings", "/trips/", "/login", "/register"],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
