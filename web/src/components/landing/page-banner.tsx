import Image from "next/image";
import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn";
import { GlassPanel } from "@/components/ui/glass";

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
    <section className="relative isolate flex overflow-hidden p-3 sm:p-6">
      <Image src={photo} alt="" fill preload={preload} sizes="100vw" className="-z-20 object-cover" />
      <div aria-hidden className="absolute inset-0 -z-10 bg-linear-to-b from-scrim/45 via-scrim/35 via-40% to-scrim/80" />
      <GlassPanel
        tone="frame"
        className={cn(
          "mx-auto flex w-full max-w-6xl flex-col rounded-[2rem] px-4 sm:px-10",
          hero ? "gap-7 pb-6 pt-16 sm:pb-10 sm:pt-28" : "gap-4 pb-6 pt-10 sm:pb-8 sm:pt-14",
          frameClass,
        )}
      >
        <div className="flex max-w-3xl flex-col gap-3 text-white">
          {eyebrow && (
            <span className="self-start rounded-full border border-white/20 bg-navy/40 px-3.5 py-1.5 text-sm font-semibold backdrop-blur-lg">
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
