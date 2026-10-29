import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: "Terms of service" };

export default function Page() {
  return <LegalPage title="Terms of service" sections={["What we are", "Your account", "Booking", "Your responsibilities", "Our responsibility", "Complaints"]} />;
}
