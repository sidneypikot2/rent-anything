import type { ReactNode } from "react";
import { CurrentPlaceProvider } from "@/components/landing/current-place";
import { SectionHeader } from "@/components/landing/section-header";
import { SectionSwitch } from "@/components/landing/section-switch";
import { SiteBackdrop } from "@/components/landing/site-backdrop";
import { SiteFooter } from "@/components/landing/site-footer";

// The skip link is the first thing a keyboard reaches; it jumps past the header to the page's
// content, whose wrapper takes the focus and lays the page out as the body did.
export default function GuestLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <a
        href="#content"
        className="focus-light sr-only rounded-full bg-white font-bold text-navy shadow-lift focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-5 focus:py-3"
      >
        Skip to content
      </a>
      <SiteBackdrop />
      <CurrentPlaceProvider>
        <SectionHeader section="guest" />
        <div id="content" tabIndex={-1} className="flex flex-1 flex-col outline-none">
          {children}
        </div>
      </CurrentPlaceProvider>
      <SiteFooter />
      <SectionSwitch to="partner" />
    </>
  );
}
