import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SectionHeader } from "@/components/landing/section-header";

// The admin console is for the team only: keep it out of search results.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SectionHeader section="admin" />
      {children}
    </>
  );
}
