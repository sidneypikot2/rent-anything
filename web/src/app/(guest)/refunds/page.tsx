import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { BRAND } from "@/lib/brand";
import { canonical } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Cancellations and refunds",
  description: `Cancellations and refunds on ${BRAND}: what happens when you or the partner cancels, weather and sea conditions, and how refunds are paid.`,
  alternates: canonical("/refunds"),
};

export default function Page() {
  return <LegalPage title="Cancellations and refunds" sections={["If you cancel", "If the partner cancels", "Weather and sea conditions", "How refunds are paid"]} />;
}
