import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PageSheet } from "@/components/landing/page-sheet";
import { SectionHeader } from "@/components/landing/section-header";
import { SiteBackdrop } from "@/components/landing/site-backdrop";

// The admin console is for the team only: keep it out of search results.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

// On the guest pages' backdrop, on the white sheet the partner pages use (RAA-120): the console
// is a work screen, not browsing (RAA-142). Wide, so the console tables get the room; the
// sign-in and the UI kit keep to the page width themselves.
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteBackdrop />
      <SectionHeader section="admin" />
      <div className="flex flex-1 flex-col pt-3 sm:pt-6">
        <PageSheet tone="paper" wide>{children}</PageSheet>
      </div>
    </>
  );
}
