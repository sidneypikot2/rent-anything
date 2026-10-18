import type { Metadata } from "next";
import { Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { BRAND, TAGLINE } from "@/lib/brand";
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
  // Pages set a short title ("Search"); the template adds the brand.
  title: { default: `${BRAND} · ${TAGLINE}`, template: `%s · ${BRAND}` },
  description: `${TAGLINE}. Islands, mountains and cities of the Philippines: tours, transfers, rentals and stays, planned together in one cart.`,
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
