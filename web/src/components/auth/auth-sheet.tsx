import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn";
import { AuthCarousel } from "./auth-carousel";

// A sign-in frame's height from lg: as tall as the home hero, whose contents reach about 46.5rem,
// or the first screen on a shorter window, so going from / to sign in leaves the frame in place.
export const AUTH_FRAME_HEIGHT = "lg:min-h-[min(calc(100svh-6.75rem),46.5rem)]";

// Guest sign-in and sign-up (RAA-253): one white sheet on the site's photo backdrop, all of it on
// the first screen, with the footer below that, 12px under the header like the home hero. From lg
// the sheet shares one frame with the carousel: the frame owns the edge and the shadow and clips
// both, so the sheet needs neither and its left corners are a clean white curve on the photo. The
// form is 27rem wide so Google's button, which won't draw under about 186px, matches Facebook's in
// half of it. The form is an AuthCard with `plain`, as this sheet is its card.
export function AuthSheet({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-[calc(100svh-var(--chrome))] items-start px-2 pb-3 pt-3 short:pb-1 sm:px-6 lg:pb-6">
      {/* From sm the sheet sits right, its edge on the header's. */}
      <div className="mx-auto flex w-full max-w-page justify-center sm:justify-end">
        <div className={cn("card-edge relative isolate flex w-full max-w-108 overflow-hidden rounded-frame shadow-float lg:max-w-none lg:justify-end lg:bg-navy", AUTH_FRAME_HEIGHT)}>
          <AuthCarousel />
          <div className="relative z-10 flex w-full max-w-108 shrink-0 flex-col justify-center rounded-frame bg-surface p-card text-foreground lg:rounded-r-none">
            {children}
          </div>
        </div>
      </div>
    </main>
  );
}

// Partner sign-in and sign-up: the same place and height as the guests' frame, white all over, with
// the pitch where the guests' photos are, and the same compact form (AuthCard `plain`), so sign-in
// fits the first screen. Below lg the form comes first, so a phone doesn't scroll past the pitch.
export function PartnerAuthFrame({ pitch, children }: { pitch: ReactNode; children: ReactNode }) {
  return (
    <main className="px-2 pb-2 pt-3 sm:px-6 sm:pb-6">
      <div className={cn("card-edge mx-auto grid w-full max-w-page items-center gap-block rounded-frame bg-surface p-card text-foreground shadow-float sm:px-12 lg:grid-cols-[minmax(0,1fr)_24rem]", AUTH_FRAME_HEIGHT)}>
        {pitch}
        <div className="max-lg:order-first">{children}</div>
      </div>
    </main>
  );
}
