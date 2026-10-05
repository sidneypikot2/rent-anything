import Link from "next/link";
import { AccountNav } from "@/components/auth/account-nav";

export type Section = "guest" | "partner" | "admin";

const SECTION_LABELS: Record<Section, string> = {
  guest: "",
  partner: "Partners",
  admin: "Admin",
};

// The site header for one of the three entry points: guests at /, partners at
// /partner, developers at /admin. Sections don't link to each other: partners and guests
// have separate entry points.
export function SectionHeader({ section }: { section: Section }) {
  const label = SECTION_LABELS[section];

  return (
    <header className="bg-navy text-white">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <Link
          href={section === "guest" ? "/" : `/${section}`}
          className="font-display text-2xl font-bold italic"
        >
          Rent-<span className="not-italic text-aqua">Anything</span>
          {label && (
            <span className="ml-2 font-sans text-sm font-medium not-italic text-on-dark">
              {label}
            </span>
          )}
        </Link>
        <nav className="flex items-center gap-4 text-sm font-medium text-on-dark [&_a]:hover:text-white">
          <AccountNav section={section} />
        </nav>
      </div>
    </header>
  );
}
