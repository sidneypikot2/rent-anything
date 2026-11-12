import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { BRAND } from "@/lib/brand";
import { canonical } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Terms of service",
  description: `The terms for using ${BRAND}: your account, sending booking requests to local partners, what you and we are responsible for, and how to complain.`,
  alternates: canonical("/terms"),
};

export default function Page() {
  return <LegalPage title="Terms of service" sections={["What we are", "Your account", "Booking", "Your responsibilities", "Our responsibility", "Complaints"]} />;
}
