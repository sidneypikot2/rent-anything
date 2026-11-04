import type { ReactNode } from "react";
import { SectionHeader } from "@/components/landing/section-header";
import { SiteBackdrop } from "@/components/landing/site-backdrop";

// The partner pages sit on the guest pages' backdrop. Signed-in pages take a white sheet from their
// own layout, and /partner/login and /partner/register a frame of their own (PartnerAuthFrame).
export default function PartnerLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteBackdrop />
      <SectionHeader section="partner" />
      {children}
    </>
  );
}
