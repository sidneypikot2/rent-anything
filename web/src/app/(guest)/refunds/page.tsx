import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: "Cancellations and refunds" };

export default function Page() {
  return <LegalPage title="Cancellations and refunds" sections={["If you cancel", "If the partner cancels", "Weather and sea conditions", "How refunds are paid"]} />;
}
