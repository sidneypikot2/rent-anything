import Link from "next/link";
import { GlassPanel } from "@/components/ui/glass";
import { TAGLINE } from "@/lib/brand";
import { Logo } from "./logo";

const LINKS = [
  { href: "/#destinations", label: "Destinations" },
  { href: "/#activities", label: "Activities" },
  { href: "/partner/register", label: "List with us" },
];

// The guest footer: a few links and the line about what we are, on glass over the guest
// pages' fixed backdrop (Sky & Forest, RAA-102; RAA-107).
export function SiteFooter() {
  return (
    <footer className="focus-light mt-auto text-white">
      <div className="mx-auto flex w-full max-w-page flex-col gap-gutter px-gutter py-8 sm:flex-row sm:items-stretch sm:py-10">
        <div className="flex flex-1 flex-col justify-center gap-1">
          <Logo className="text-2xl" />
          <p className="font-display font-semibold text-sky-mist">{TAGLINE}</p>
        </div>
        <GlassPanel tone="forest" className="flex flex-col gap-4 rounded-card p-card text-sm sm:min-w-80">
          <nav aria-label="Footer" className="flex flex-wrap gap-2">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex min-h-11 items-center rounded-full border border-glass-edge bg-glass-fill px-4 font-medium hover:bg-glass-hover"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <p className="text-pretty text-sky-mist">Local partners · starting on Bantayan Island, Cebu</p>
        </GlassPanel>
      </div>
    </footer>
  );
}
