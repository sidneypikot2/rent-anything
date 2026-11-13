import { ImageResponse } from "next/og";
import { LogoCard, ogFonts } from "@/lib/og";

// /logo.png (RAA-241): the square logo the home's Organization JSON-LD names, as search engines
// want one of at least 112px. Made once at build time.
export const dynamic = "force-static";

export async function GET() {
  return new ImageResponse(<LogoCard />, { width: 512, height: 512, fonts: await ogFonts() });
}
