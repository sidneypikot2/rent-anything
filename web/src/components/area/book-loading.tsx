import type { ReactNode } from "react";
import { bookIntro, WhatToBookSkeleton } from "@/components/area/area-listings";
import { PageBanner } from "@/components/landing/page-banner";
import { PageSheet } from "@/components/landing/page-sheet";
import { cn } from "@/components/ui/cn";
import { DisplayTitle } from "@/components/ui/typography";

// Text set like the real thing but hidden, a pulsing bar behind each line it wraps to, so the
// skeleton takes the height the words will.
function Ghost({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "rounded-lg bg-white/20 text-transparent box-decoration-clone select-none motion-safe:animate-pulse",
        className,
      )}
    >
      {children}
    </span>
  );
}

// What to book while its page renders on the server: the page's own banner, dates bar and sheet,
// with the same skeleton the page shows while its cards load (WhatToBookSkeleton), so the loading
// file and the page's Suspense draw one picture rather than one swapping to another. `list` is a
// section's Show all page: its eyebrow and title, no lead line, and the grid.
export function BookLoading({ list = false }: { list?: boolean }) {
  const backPill = "tap-target self-start rounded-full border border-transparent px-4 py-2 text-sm font-semibold";
  const back = <Ghost>← {list ? "What to book" : "Back to the place"}</Ghost>;
  return (
    <main role="status" aria-busy className="flex flex-1 flex-col">
      <span className="sr-only">Loading what to book…</span>
      <PageBanner
        compact
        frameClass="max-sm:px-5! max-sm:pb-14 sm:pb-12"
        dim={!list}
        search={false}
        eyebrow={<Ghost className="bg-white/15">{list ? "What to book on this island" : "Philippines"}</Ghost>}
        title={
          <>
            <span className={cn(backPill, "-order-1 sm:hidden")}>{back}</span>
            <span className="flex min-w-0 flex-col gap-2 sm:gap-3">
              <DisplayTitle as="p" className="min-w-0 text-balance">
                <Ghost>{list ? "Stays on this island" : "What to book on this island"}</Ghost>
              </DisplayTitle>
              {!list && (
                <p className="max-w-lede text-lg font-medium text-pretty max-sm:text-base">
                  <Ghost className="bg-white/15">{bookIntro(2)}</Ghost>
                </p>
              )}
            </span>
          </>
        }
      >
        <span className={cn(backPill, "max-sm:hidden")}>{back}</span>
      </PageBanner>

      {/* The dates bar, across the seam, its height (BookDates' field: 56px, 80px from sm). */}
      <div aria-hidden className="relative z-36 -my-7 flex justify-center px-6 sm:-my-10">
        <div className="card-edge h-14 w-56 max-w-full rounded-frame bg-surface shadow-float sm:h-20 sm:w-80" />
      </div>

      <PageSheet tone="clear">
        <div className="mx-auto w-full max-w-page">
          <div className={cn("page-sections flex min-w-0 flex-col gap-section pb-page-pad", list && "pt-block")}>
            <WhatToBookSkeleton list={list} />
          </div>
        </div>
      </PageSheet>
    </main>
  );
}
