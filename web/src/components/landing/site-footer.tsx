import { GlassPanel } from "@/components/ui/glass";
import { TAGLINE } from "@/lib/brand";
import { FooterNav } from "./footer-nav";
import { LAUNCH_AREA } from "./launch-area";
import { Logo } from "./logo";

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
          {/* Two to a row on a phone, the partners' link under them across both, so the three
              pills read as a set rather than wrapping one short. */}
          <FooterNav />
          <p className="text-pretty text-sky-mist">Local partners · starting on {LAUNCH_AREA.name}, {LAUNCH_AREA.region}</p>
        </GlassPanel>
      </div>
    </footer>
  );
}
