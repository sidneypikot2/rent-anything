import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn";
import { GlassPanel } from "@/components/ui/glass";
import { HEADER_PULL } from "./section-header";

// The top of a main page (Sky & Forest, RAA-102): the page's eyebrow, title, intro and
// actions in white on a glass frame, over the guest pages' fixed backdrop (RAA-107).
// `hero` is the home page's taller one; pass `frameClass` for the frame's own spacing.
export function PageBanner({
  eyebrow,
  title,
  children,
  hero = false,
  frameClass,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  children?: ReactNode;
  hero?: boolean;
  frameClass?: string;
}) {
  return (
    // Pulled up under the floating header, with room at the top so the frame clears it. The
    // frame's contents ease up one after another.
    <section className={cn("relative isolate flex px-3 pb-3 pt-20 sm:px-6 sm:pb-6 sm:pt-22", HEADER_PULL)}>
      <GlassPanel
        tone="frame"
        className={cn(
          "mx-auto flex w-full max-w-page flex-col rounded-frame px-5 sm:px-12",
          "*:animate-rise [&>*:nth-child(2)]:stagger-1 [&>*:nth-child(3)]:stagger-2 [&>*:nth-child(n+4)]:stagger-3",
          hero ? "gap-block pb-8 pt-10 sm:pb-10 sm:pt-16" : "gap-6 pb-8 pt-10 sm:pb-10 sm:pt-12",
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
