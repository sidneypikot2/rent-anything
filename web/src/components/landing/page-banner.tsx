import Image from "next/image";
import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn";
import { GlassPanel } from "@/components/ui/glass";
import { HEADER_PULL } from "./section-header";

type Photo = { src: string; alt: string };

// The top of a main page (Sky & Forest, RAA-102): the page's eyebrow, title, intro and
// actions in white on a glass frame, over the guest pages' fixed backdrop (RAA-107).
// `hero` is the home page's taller one; pass `frameClass` for the frame's own spacing.
// With a `photo` (RAA-108) the frame shows it, slowly drifting, under a scrim that darkens its
// foot, and the contents sit at the bottom on that scrim instead of on glass: the page opens
// on the place rather than on the tinted backdrop.
export function PageBanner({
  eyebrow,
  title,
  children,
  hero = false,
  photo,
  frameClass,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  children?: ReactNode;
  hero?: boolean;
  photo?: Photo;
  frameClass?: string;
}) {
  const contents = (
    <>
      <div className="flex max-w-prose flex-col gap-4 text-white">
        {eyebrow && (
          <span className="self-start rounded-full border border-glass-edge bg-navy/40 px-3.5 py-1.5 text-sm font-semibold backdrop-blur-lg">
            {eyebrow}
          </span>
        )}
        {title}
      </div>
      {children}
    </>
  );
  // The frame's contents ease up one after another.
  const stagger =
    "*:animate-rise [&>*:nth-child(2)]:stagger-1 [&>*:nth-child(3)]:stagger-2 [&>*:nth-child(n+4)]:stagger-3";

  return (
    // Pulled up under the floating header, with room at the top so the frame clears it.
    <section className={cn("relative isolate flex px-3 pb-3 pt-20 sm:px-6 sm:pb-6 sm:pt-22", HEADER_PULL)}>
      {photo ? (
        <div
          className={cn(
            "card-edge relative isolate mx-auto flex w-full max-w-page flex-col justify-end overflow-hidden rounded-frame px-5 text-white shadow-float sm:px-12",
            // On a phone the contents set the height, so the hero's search and pills stay on the first screen.
            hero
              ? "gap-block pb-8 pt-28 sm:min-h-[min(82svh,48rem)] sm:pt-40 sm:pb-12"
              : "gap-6 pb-8 pt-24 sm:min-h-[min(60svh,34rem)] sm:pt-32 sm:pb-10",
            frameClass,
          )}
        >
          <Image
            src={photo.src}
            alt={photo.alt}
            fill
            preload
            sizes="(min-width: 72rem) 72rem, 100vw"
            className="-z-20 object-cover motion-safe:animate-drift"
          />
          {/* Darkest at the foot, where the text is; the top of the photo stays clear. */}
          <div aria-hidden className="absolute inset-0 -z-10 bg-linear-to-t from-scrim/85 via-scrim/45 to-scrim/5" />
          <div className={cn("flex flex-col", hero ? "gap-block" : "gap-6", stagger)}>{contents}</div>
        </div>
      ) : (
        <GlassPanel
          tone="frame"
          className={cn(
            "mx-auto flex w-full max-w-page flex-col rounded-frame px-5 sm:px-12",
            stagger,
            hero ? "gap-block pb-8 pt-10 sm:pb-10 sm:pt-16" : "gap-6 pb-8 pt-10 sm:pb-10 sm:pt-12",
            frameClass,
          )}
        >
          {contents}
        </GlassPanel>
      )}
    </section>
  );
}
