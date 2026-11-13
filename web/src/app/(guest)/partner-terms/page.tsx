import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { BRAND } from "@/lib/brand";
import { canonical } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Partner terms",
  description: `The terms for local partners listing on ${BRAND}: who can list, your listings, bookings, payment and commission, and ending the agreement.`,
  alternates: canonical("/partner-terms"),
};

export default function Page() {
  return <LegalPage title="Partner terms" sections={["Who can list", "Your listings", "Bookings", "Payment and commission", "Ending the agreement"]} />;
}
