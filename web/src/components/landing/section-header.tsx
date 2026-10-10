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
export function SectionHeader({ section }: { section: Section }) {
  const label = SECTION_LABELS[section];

  return (
    <header className="bg-navy text-white">
      <div className="mx-auto flex min-h-14 w-full max-w-5xl items-center justify-between gap-4 px-4">
        <Link
          href={section === "guest" ? "/" : `/${section}`}
          className="py-3 text-2xl"
          aria-label={label ? `${BRAND} ${label}` : `${BRAND} home`}
        >
          <Logo />
          {label && (
            <span className="ml-2 font-sans text-sm font-medium not-italic text-on-dark">
              {label}
            </span>
          )}
        </Link>
        {/* Full height, so the account menu's tab reaches the bar's bottom edge. */}
        <nav className="flex flex-wrap items-center self-stretch justify-end gap-x-6 gap-y-2 text-sm font-medium text-on-dark">
          {section === "partner" && <PartnerNav />}
          {section === "guest" && <CartLink />}
          <AccountNav section={section} />
        </nav>
      </div>
    </header>
  );
}
