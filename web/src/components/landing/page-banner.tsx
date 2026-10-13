import Image from "next/image";
import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn";
import { GlassPanel } from "@/components/ui/glass";
import { HEADER_PULL } from "./section-header";

// The top of a main page (Sky & Forest, RAA-102): a full-width photo with a scrim, and the
// page's eyebrow, title, intro and actions in white on a glass frame. The photo is
// decorative, so it has no alt text. `hero` is the home page's taller one; pass `frameClass`
// for the frame's own spacing.
export function PageBanner({
  photo,
  eyebrow,
  title,
  children,
  hero = false,
  preload = false,
  frameClass,
}: {
  photo: string;
  eyebrow?: ReactNode;
  title: ReactNode;
  children?: ReactNode;
  hero?: boolean;
  preload?: boolean;
  frameClass?: string;
}) {
  return (
    // Pulled up under the floating header, with room at the top so the frame clears it. The
    // photo drifts very slowly; the frame's contents ease up one after another.
    <section className={cn("relative isolate flex overflow-hidden px-3 pb-3 pt-20 sm:px-6 sm:pb-6 sm:pt-22", HEADER_PULL)}>
      <Image src={photo} alt="" fill preload={preload} sizes="100vw" className="-z-20 animate-drift object-cover will-change-transform" />
      <div aria-hidden className="absolute inset-0 -z-10 bg-linear-to-b from-scrim/45 via-scrim/35 via-40% to-scrim/80" />
      <GlassPanel
        tone="frame"
        className={cn(
          "mx-auto flex w-full max-w-page flex-col rounded-frame px-5 sm:px-12",
          "*:animate-rise [&>*:nth-child(2)]:stagger-1 [&>*:nth-child(3)]:stagger-2 [&>*:nth-child(n+4)]:stagger-3",
          hero ? "gap-block pb-8 pt-16 sm:pb-12 sm:pt-32" : "gap-6 pb-8 pt-12 sm:pb-12 sm:pt-20",
          frameClass,
        )}
      >
        <div className="flex max-w-prose flex-col gap-4 text-white">
          {eyebrow && (
            <span className="self-start rounded-full border border-glass-edge bg-navy/40 px-3.5 py-1.5 text-sm font-semibold backdrop-blur-lg">
              {eyebrow}
            </span>
          )}
          {title}
        </div>
        {children}
      </GlassPanel>
    </section>
  );
}
