import Link from "next/link";
import { AdminNav } from "@/components/admin/admin-nav";
import { AccountNav } from "@/components/auth/account-nav";
import { Logo } from "@/components/landing/logo";
import { PartnerNav } from "@/components/partner/partner-nav";
import { CartLink } from "@/components/trips/cart-link";
import { HeaderSearch } from "./search-bar";
import { BackdropStrip } from "./site-backdrop";
import { BRAND } from "@/lib/brand";

export type Section = "guest" | "partner" | "admin";

const SECTION_LABELS: Record<Section, string> = {
  guest: "",
  partner: "Partners",
  admin: "Admin",
};

// The site header for one of the three entry points: guests at /, partners at
// /partner, developers at /admin. Sections don't link to each other: partners and guests
// have separate entry points. The one exception is SectionSwitch, a floating test aid
// shown locally and on staging only.
// Sky & Forest (RAA-102): a floating glass bar, inset from the edges and sticky, nearly solid so
// a white sheet's text scrolling beneath doesn't read through it — solid on a phone, where cards' text and the stuck
// chips read through the glass. A PageBanner starts 12px under it (RAA-125) rather
// than sliding beneath it, so the bar never covers the banner's frame. Partner links take their own row on a phone; on the
// smallest phones the bar's padding tightens so the logo and the guest's account links share one.
// Above and beside it the backdrop shows, never the page scrolling under it (BackdropStrip).
// On a guest page with a search, the search's pill sits in it (HeaderSearch): between the logo and
// the cart from the search breakpoint, on its own row under them on a phone.
export function SectionHeader({ section }: { section: Section }) {
  const label = SECTION_LABELS[section];

  return (
    <header className="pointer-events-none sticky top-0 z-40 px-3 pt-3 sm:px-6">
      <BackdropStrip />
      <div className="pointer-events-auto relative mx-auto flex min-h-14 w-full max-w-page animate-float-in flex-wrap items-center justify-between gap-x-3 gap-y-2 focus-light rounded-frame border border-glass-edge bg-navy/92 max-search:bg-navy px-3 py-1.5 text-white shadow-lift backdrop-blur-xl backdrop-saturate-150 max-xs:gap-x-2 max-xs:px-2 sm:px-5">
        <Link
          href={section === "guest" ? "/" : `/${section}`}
          className="tap-target pl-1 text-xl sm:text-2xl"
          aria-label={label ? `${BRAND} ${label}` : `${BRAND} home`}
        >
          <Logo />
          {label && (
            <span className="ml-2 font-sans text-sm font-medium text-on-dark">
              {label}
            </span>
          )}
        </Link>
        {section === "guest" && <HeaderSearch />}
        <nav aria-label="Main" className="contents text-sm font-medium text-on-dark">
          {section === "partner" && <PartnerNav />}
          {section === "admin" && <AdminNav />}
          <div className="flex items-center gap-2">
            {section === "guest" && <CartLink />}
            <AccountNav section={section} />
          </div>
        </nav>
      </div>
    </header>
  );
}
