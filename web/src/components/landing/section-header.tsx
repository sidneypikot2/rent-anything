import Link from "next/link";

export type Section = "guest" | "partner" | "admin";

const SECTION_LABELS: Record<Section, string> = {
  guest: "",
  partner: "Partners",
  admin: "Admin",
};

// The site header for one of the three entry points: guests at /, partners at
// /partner, developers at /admin. Each section links to the other public one.
export function SectionHeader({ section }: { section: Section }) {
  const label = SECTION_LABELS[section];

  return (
    <header className="bg-navy text-white">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <Link href={section === "guest" ? "/" : `/${section}`} className="font-semibold">
          Rent-<span className="text-gold">Anything</span>
          {label && <span className="ml-2 text-sm font-normal text-mist">{label}</span>}
        </Link>
        <nav className="text-sm text-mist [&_a]:hover:text-white">
          {section === "guest" && <Link href="/partner">List with us</Link>}
          {section === "partner" && <Link href="/">Book a trip</Link>}
        </nav>
      </div>
    </header>
  );
}
