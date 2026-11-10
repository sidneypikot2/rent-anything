import { GlassPanel } from "@/components/ui/glass";
import { BRAND, BUSINESS_ADDRESS, TAGLINE } from "@/lib/brand";
import { FooterNav } from "./footer-nav";
import { LAUNCH_AREA } from "./launch-area";
import { Logo } from "./logo";
import { SocialLinks } from "./social-links";

// The guest footer, on the guest pages' fixed backdrop (Sky & Forest, RAA-102; RAA-107): one band of
// the trip band's glass, edge to edge and down to the page's foot, square — the brand,
// the links in columns and, at its foot, who runs the site, kept to the page's width inside it. The
// brand leads on a phone and sits beside the links from lg.
export function SiteFooter() {
  return (
    <footer data-site-footer className="focus-light mt-auto pt-8 text-white lg:pt-10">
      <GlassPanel tone="forest" className="border-x-0 border-b-0 text-sm">
        {/* --foot-space: room for buttons floating at the window's foot (globals.css). */}
        <div className="mx-auto flex w-full max-w-page flex-col gap-6 px-gutter pt-8 pb-[calc(2rem+var(--foot-space,0px))] lg:pt-10 lg:pb-[calc(2.5rem+var(--foot-space,0px))]">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,16rem)_1fr] lg:gap-gutter">
            <div className="flex flex-col gap-1">
              <Logo className="text-2xl" />
              <p className="font-display text-base font-semibold text-sky-mist">{TAGLINE}</p>
              <p className="text-pretty text-sky-mist">
                Local partners · starting on {LAUNCH_AREA.name}, {LAUNCH_AREA.region}
              </p>
              <SocialLinks className="mt-2 -ml-1" />
            </div>
            <FooterNav />
          </div>
          {/* Who runs the site; Company's Contact us is how to reach us. */}
          <address className="border-t border-glass-edge pt-4 not-italic text-sky-mist" data-testid="footer-business">
            © {new Date().getFullYear()} {BRAND} · {BUSINESS_ADDRESS}
          </address>
        </div>
      </GlassPanel>
    </footer>
  );
}
