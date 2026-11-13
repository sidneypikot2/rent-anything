import { ImageResponse } from "next/og";
import { ogFonts, ShareCard } from "@/lib/og";
import { DEFAULT_OG_IMAGE } from "@/lib/seo";

// The default share image (RAA-233), at /opengraph-image: every page without a photo of its own
// (an area or a listing with photos shares its cover, `openGraph()` in lib/seo.ts, which names
// this one when there is none). Made once at build time.
export const alt = DEFAULT_OG_IMAGE.alt;
export const size = { width: DEFAULT_OG_IMAGE.width, height: DEFAULT_OG_IMAGE.height };
export const contentType = "image/png";

export default async function OpenGraphImage() {
  return new ImageResponse(<ShareCard />, { ...size, fonts: await ogFonts() });
}
