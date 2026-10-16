import type { Metadata } from "next";
import { DM_Sans, Geist_Mono, Manrope } from "next/font/google";
import { BRAND, TAGLINE } from "@/lib/brand";
import { Providers } from "./providers";
import "./globals.css";

// DM Sans for headings and text, sized optically; Manrope for numbers (`nums`, RAA-127). DM
// Sans has no peso sign, so both stacks fall back to Manrope for it (globals.css); it lives
// in latin-ext, whose file loads only on a page that shows one.
const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin", "latin-ext"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Pages set a short title ("Search"); the template adds the brand.
  title: { default: `${BRAND} · ${TAGLINE}`, template: `%s · ${BRAND}` },
  description: `${TAGLINE}. Islands, mountains and cities of the Philippines: tours, rides, gear and stays, planned together in one cart.`,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${manrope.variable} ${geistMono.variable} h-full scroll-pt-(--chrome) antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
