import Link from "next/link";
import { AccountNav } from "@/components/auth/account-nav";
import { Logo } from "@/components/landing/logo";
import { PartnerNav } from "@/components/partner/partner-nav";
import { CartLink } from "@/components/trips/cart-link";
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
// Sky & Forest (RAA-102): a sticky frosted bar, so the page shows through it as it scrolls
// beneath, with the links on a glass pill. Partner links take their own row on a phone.
export function SectionHeader({ section }: { section: Section }) {
  const label = SECTION_LABELS[section];

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-navy/75 text-white backdrop-blur-xl">
      <div className="mx-auto flex min-h-16 w-full max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2.5">
        <Link
          href={section === "guest" ? "/" : `/${section}`}
          className="text-2xl"
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
