import type { Metadata } from "next";
import { Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { BRAND, TAGLINE } from "@/lib/brand";
import { siteIndexable, siteUrl } from "@/lib/config";
import { OPEN_GRAPH } from "@/lib/seo";
import { Providers } from "./providers";
import "./globals.css";

// The one family for headings and text (Sky & Forest, RAA-102).
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Relative metadata URLs (canonical, Open Graph images) resolve against the site's origin.
  metadataBase: new URL(siteUrl()),
  // Pages set a short title ("Search"); the template adds the brand.
  title: { default: `${BRAND} · ${TAGLINE}`, template: `%s · ${BRAND}` },
  description: `${TAGLINE}. Islands, mountains and cities of the Philippines: tours, transfers, rentals and stays, planned together in one cart.`,
  // Shared links (RAA-233): og:title and og:description follow each page's own, and the image is
  // app/opengraph-image.tsx unless the page shares its own photo (openGraph() in lib/seo.ts).
  openGraph: OPEN_GRAPH,
  twitter: { card: "summary_large_image" },
  // Off an indexable deployment (staging, local), every page says noindex (RAA-247); a page's
  // own robots setting still wins, so the noindex ones stay noindex in production.
  ...(siteIndexable() ? {} : { robots: { index: false, follow: false } }),
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${jakarta.variable} ${geistMono.variable} h-full scroll-pt-(--chrome) antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
