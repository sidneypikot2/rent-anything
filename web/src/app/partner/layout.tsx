import type { ReactNode } from "react";
import { SectionHeader } from "@/components/landing/section-header";

export default function PartnerLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SectionHeader section="partner" />
      {children}
    </>
  );
}
