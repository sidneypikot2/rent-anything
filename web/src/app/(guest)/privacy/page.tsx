import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: "Privacy policy" };

export default function Page() {
  return <LegalPage title="Privacy policy" sections={["What we collect", "Who we share it with", "Cookies and browser storage", "How long we keep it", "Your rights", "Contact"]} />;
}
