import type { ReactNode } from "react";
import { SectionHeader } from "@/components/landing/section-header";
import { SectionSwitch } from "@/components/landing/section-switch";
import { SiteBackdrop } from "@/components/landing/site-backdrop";
import { SiteFooter } from "@/components/landing/site-footer";

export default function GuestLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteBackdrop />
      <SectionHeader section="guest" />
      {children}
      <SiteFooter />
      <SectionSwitch to="partner" />
    </>
  );
}
