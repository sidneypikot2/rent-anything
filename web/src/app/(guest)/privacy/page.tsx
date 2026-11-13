import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { BRAND } from "@/lib/brand";
import { canonical } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: `How ${BRAND} handles your personal data: what we collect, who we share it with, cookies and browser storage, how long we keep it and your rights.`,
  alternates: canonical("/privacy"),
};

export default function Page() {
  return <LegalPage title="Privacy policy" sections={["What we collect", "Who we share it with", "Cookies and browser storage", "How long we keep it", "Your rights", "Contact"]} />;
}
