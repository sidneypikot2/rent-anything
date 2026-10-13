import type { ReactNode } from "react";
import { PageSheet } from "@/components/landing/page-sheet";
import { SectionHeader } from "@/components/landing/section-header";
import { SectionSwitch } from "@/components/landing/section-switch";
import { SiteBackdrop } from "@/components/landing/site-backdrop";

// The partner pages sit on the guest pages' backdrop and glass sheet (RAA-107), wrapped here
// once: none has a banner of its own.
export default function PartnerLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteBackdrop />
      <SectionHeader section="partner" />
      <div className="flex flex-1 flex-col pt-3 sm:pt-6">
        <PageSheet>{children}</PageSheet>
      </div>
      <SectionSwitch to="guest" />
    </>
  );
}
