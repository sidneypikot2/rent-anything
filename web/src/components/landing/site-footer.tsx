import Link from "next/link";
import { LEGAL_LINKS } from "@/components/legal/legal-page";
import { GlassPanel } from "@/components/ui/glass";
import { BRAND, BUSINESS_ADDRESS, SUPPORT_EMAIL, TAGLINE } from "@/lib/brand";
import { FooterNav } from "./footer-nav";
import { LAUNCH_AREA } from "./launch-area";
import { Logo } from "./logo";
import { SocialLinks } from "./social-links";

// The guest footer: a few links, the line about what we are and who runs the site, on glass over the guest
// pages' fixed backdrop (Sky & Forest, RAA-102; RAA-107).
export function SiteFooter() {
  return (
    <footer className="focus-light mt-auto text-white">
      <div className="mx-auto flex w-full max-w-page flex-col gap-gutter px-gutter py-8 sm:flex-row sm:items-stretch sm:py-10">
        {/* On a phone the brand and socials close the page, under the links panel. */}
        <div className="order-last flex flex-1 flex-col justify-center gap-1 sm:order-none">
          <Logo className="text-2xl" />
          <p className="font-display font-semibold text-sky-mist">{TAGLINE}</p>
          {/* Who runs the site and how to reach us. */}
          <address className="mt-2 text-sm not-italic text-sky-mist" data-testid="footer-business">
            {BRAND} · {BUSINESS_ADDRESS}
            <br />
            <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-white underline underline-offset-4 hover:text-sky-pale">
              {SUPPORT_EMAIL}
            </a>
          </address>
          <SocialLinks className="mt-3" />
        </div>
        <GlassPanel tone="forest" className="flex flex-col gap-4 rounded-card p-card text-sm sm:min-w-80">
          {/* Two to a row on a phone: the four pills read as a set. */}
          <FooterNav />
          <p className="text-pretty text-sky-mist">Local partners · starting on {LAUNCH_AREA.name}, {LAUNCH_AREA.region}</p>
          {/* The legal pages: quiet text links, so the four pills stay the footer's way around. */}
          <nav aria-label="Legal" className="-mx-2 flex flex-wrap border-t border-glass-edge pt-2">
            {LEGAL_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex min-h-11 items-center px-2 text-sky-mist underline-offset-4 hover:text-white hover:underline"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </GlassPanel>
      </div>
    </footer>
  );
}
