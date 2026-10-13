import Link from "next/link";
import { AccountNav } from "@/components/auth/account-nav";
import { Logo } from "@/components/landing/logo";
import { PartnerNav } from "@/components/partner/partner-nav";
import { CartLink } from "@/components/trips/cart-link";
import { BRAND } from "@/lib/brand";

export type Section = "guest" | "partner" | "admin";

// How far a PageBanner pulls up under the floating header: its top inset (pt-3) plus the
// bar's height (min-h-14), so the photo starts at the top of the window.
export const HEADER_PULL = "-mt-17";

const SECTION_LABELS: Record<Section, string> = {
  guest: "",
  partner: "Partners",
  admin: "Admin",
};

// The site header for one of the three entry points: guests at /, partners at
// /partner, developers at /admin. Sections don't link to each other: partners and guests
// have separate entry points. The one exception is SectionSwitch, a floating test aid
// shown locally and on staging only.
// Sky & Forest (RAA-102): a floating glass bar, inset from the edges and sticky, so the page
// shows through it as it scrolls beneath. A PageBanner slides up under it (HEADER_PULL), so
// on those pages it floats over the photo. Partner links take their own row on a phone.
export function SectionHeader({ section }: { section: Section }) {
  const label = SECTION_LABELS[section];

  return (
    <header className="pointer-events-none sticky top-0 z-40 px-3 pt-3 sm:px-6">
      <div className="pointer-events-auto mx-auto flex min-h-14 w-full max-w-6xl flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-[1.75rem] border border-white/15 bg-navy/70 px-3 py-1.5 text-white shadow-xl shadow-navy/25 backdrop-blur-xl backdrop-saturate-150 sm:px-5">
        <Link
          href={section === "guest" ? "/" : `/${section}`}
          className="pl-1 text-xl sm:text-2xl"
          aria-label={label ? `${BRAND} ${label}` : `${BRAND} home`}
        >
          <Logo />
          {label && (
            <span className="ml-2 font-sans text-sm font-medium text-on-dark">
              {label}
            </span>
          )}
        </Link>
        <nav className="contents text-sm font-medium text-on-dark">
          {section === "partner" && <PartnerNav />}
          <div className="flex items-center gap-2">
            {section === "guest" && <CartLink />}
            <AccountNav section={section} />
          </div>
        </nav>
      </div>
    </header>
  );
}
