import type { ReactNode } from "react";
import { SectionHeader } from "@/components/landing/section-header";

export default function GuestLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SectionHeader section="guest" />
      {children}
    </>
  );
}
