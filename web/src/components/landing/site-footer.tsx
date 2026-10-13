import Image from "next/image";
import Link from "next/link";
import { GlassPanel } from "@/components/ui/glass";
import { TAGLINE } from "@/lib/brand";
import { Logo } from "./logo";
import { BAND_PHOTO } from "./sample-photos";

const LINKS = [
  { href: "/#destinations", label: "Destinations" },
  { href: "/#activities", label: "Activities" },
  { href: "/partner/register", label: "List with us" },
];

// The guest footer: a few links and the line about what we are, on glass over a
// forest-tinted photo (Sky & Forest, RAA-102). The photo is decorative.
export function SiteFooter() {
  return (
    <footer className="relative isolate mt-auto overflow-hidden text-white">
      <Image src={BAND_PHOTO} alt="" fill sizes="100vw" className="-z-20 object-cover" />
      <div aria-hidden className="absolute inset-0 -z-10 bg-linear-to-r from-forest/95 via-forest/85 to-forest/65" />
      <div className="mx-auto flex w-full max-w-page flex-col gap-gutter px-gutter py-block sm:flex-row sm:items-stretch sm:py-16">
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
                className="flex min-h-9 items-center rounded-full border border-glass-edge bg-glass-fill px-4 font-medium hover:bg-glass-hover"
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
