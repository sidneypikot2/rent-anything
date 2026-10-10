import type { ReactNode } from "react";
import { SectionHeader } from "@/components/landing/section-header";
import { SectionSwitch } from "@/components/landing/section-switch";

export default function PartnerLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SectionHeader section="partner" />
      {children}
      <SectionSwitch to="guest" />
    </>
  );
}
