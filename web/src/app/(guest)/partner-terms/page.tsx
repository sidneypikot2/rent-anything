import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: "Partner terms" };

export default function Page() {
  return <LegalPage title="Partner terms" sections={["Who can list", "Your listings", "Bookings", "Payment and commission", "Ending the agreement"]} />;
}
