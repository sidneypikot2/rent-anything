import Link from "next/link";
import { Suspense } from "react";
import { BagGlyph, CompassGlyph, TickGlyph } from "@/components/discovery/tag-glyphs";
import { DriftingPhoto } from "@/components/landing/drifting-photo";
import { LAUNCH_AREA } from "@/components/landing/launch-area";
import { HomePlaces } from "@/components/landing/home-places";
import { HomePlanButton } from "@/components/landing/home-plan-button";
import { HomeServices } from "@/components/landing/home-services";
import { HomeClosing, HomeSteps } from "@/components/landing/home-steps";
import { HomeTabBar } from "@/components/landing/home-tab-bar";
import { HomeWhy } from "@/components/landing/home-why";
import { BACKDROP_PHOTO } from "@/components/landing/site-backdrop";

// The two quieter ways in beside Plan a trip: a clear pill with a white hairline on the dark frame.
const QUIET_WAY =
  "inline-flex h-12 items-center justify-center gap-2 rounded-full bg-glass-fill px-4 text-base font-semibold sm:px-7 text-white inset-ring-1 inset-ring-white/30 transition-colors duration-300 ease-calm hover:bg-glass-hover";

// What is true today (BOOKING_STATE): no ratings until there are reviews.
// Never "book instantly": every listing is request to book (RAA-134).
const TRUST = ["Local partners", "Plan your trip free", "Nothing paid in the app yet"];

// The guest home: three ways in (2026-11-06, after the Eateria hero on Dribbble). One dark frame
// over the site's backdrop, under the site's header: a pill saying where we are live, a centred
// headline, then Plan a trip (the guided planner, the main way in), Book one thing (the launch
// area's What to book, `/<area>/book`) and Explore Bantayan (the launch area's page) and what is true about booking,
// all over the port's photo. Under it, on a white sheet (the team's E),
// "Book just one thing" (the five kinds, each opening the launch area's What to book on it), "Get to know
// Bantayan" (its places to see, streamed in behind a skeleton), How booking works, Why TripKoNext and a
// closing Plan a trip (2026-11-08: the listings left the home). On a phone a tab bar rises at the
// foot once the hero has scrolled away (HomeTabBar).
export default function Home() {
  const areaHref = `/${LAUNCH_AREA.slug}`;
  return (
    <main data-home-page className="flex flex-1 flex-col px-2 pt-3 pb-2 sm:px-6 sm:pb-6">
      <div className="mx-auto flex w-full max-w-page flex-col gap-3 sm:gap-4">
        <section
          data-home-hero
          aria-labelledby="home-title"
          className="focus-light card-edge relative isolate flex w-full flex-col items-center overflow-hidden rounded-frame bg-navy px-5 pt-14 pb-16 text-center text-white shadow-float sm:px-10 sm:pt-24 sm:pb-28"
        >
          {/* The port's photo fills the frame, under a scrim that keeps the white text readable.
              The backdrop's sizes, so both pick the same file and it downloads once. */}
          <DriftingPhoto
            src={BACKDROP_PHOTO.src}
            alt=""
            sizes={BACKDROP_PHOTO.sizes}
            placeholder={BACKDROP_PHOTO.placeholder}
            className="-z-20 object-cover"
          />
          <div
            aria-hidden
            className="absolute inset-0 -z-10 bg-linear-to-b from-scrim/80 via-scrim/75 to-scrim/85"
          />
          <p className="inline-flex items-center gap-2 rounded-full bg-glass-fill px-3.5 py-1.5 text-small text-white inset-ring-1 inset-ring-glass-edge">
            {/* Still, not pulsing: nothing on it changes live. "Live", not "booking": nothing is
                paid in the app yet (BOOKING_STATE). */}
            <span aria-hidden className="size-2 rounded-full bg-mint" />
            Live on {LAUNCH_AREA.name}
          </p>
          <h1
            id="home-title"
            className="mt-4 max-w-3xl font-display text-4xl leading-[1.08] font-extrabold tracking-tight text-balance sm:text-5xl"
          >
            Your whole {LAUNCH_AREA.name} trip{" "}
            {/* Free to wrap: with large text the phrase is wider than a phone. */}
            <span className="font-semibold text-sky-pale italic motion-safe:animate-unveil">in one cart.</span>
          </h1>
          <p className="mt-3 max-w-md text-control text-balance text-white sm:max-w-2xl sm:text-lg">
            {/* Only what the launch area's partners list (PRODUCT.md). A phone skips the van. */}
            Island hopping, a scooter for the week, a cottage in Santa Fe
            <span className="max-sm:hidden">, the van from Hagnaya port</span>: all from local partners.
          </p>
          {/* Says what the choice is, in the buttons' order (hero proposal option A, 2026-11-07). */}
          <p className="mt-6 max-w-xs text-control font-semibold text-balance text-white sm:max-w-md">
            Plan the whole trip with a guide, <span className="text-sky-pale">or book just the one thing you need.</span>
          </p>
          <div className="mt-3 grid w-full grid-cols-2 gap-3 sm:flex sm:w-auto sm:justify-center">
            <HomePlanButton className="max-sm:col-span-2" />
            <Link href={`${areaHref}/book`} data-testid="home-book-one" className={QUIET_WAY}>
              <BagGlyph className="size-5 max-sm:hidden" />
              Book one thing
            </Link>
            <Link href={areaHref} data-testid="home-explore" className={QUIET_WAY}>
              <CompassGlyph className="size-5 max-sm:hidden" />
              Explore<span className="max-sm:hidden"> Bantayan</span>
            </Link>
          </div>
          <ul className="mt-4 flex flex-wrap justify-center gap-x-5 gap-y-2 text-small font-medium text-white/95">
            {TRUST.map((point) => (
              <li key={point} className="inline-flex items-center gap-1.5">
                <TickGlyph className="size-4 text-mint" />
                {point}
              </li>
            ))}
          </ul>
        </section>
        <div className="card-edge flex flex-col gap-6 rounded-frame bg-surface px-4 pt-6 pb-8 shadow-float sm:gap-7 sm:px-inset sm:pt-8">
          <HomeServices />
          <Suspense fallback={<PlacesSkeleton />}>
            <HomePlaces />
          </Suspense>
          <HomeSteps />
          <HomeWhy />
          <HomeClosing />
        </div>
      </div>
      <HomeTabBar />
    </main>
  );
}

function PlacesSkeleton() {
  return (
    <div role="status" aria-busy className="flex flex-col gap-4">
      <span className="sr-only">Loading places…</span>
      <div className="h-8 w-56 rounded-full bg-mist motion-safe:animate-pulse" />
      <div className="flex flex-col gap-2.5 sm:hidden">
        {[0, 1, 2].map((index) => (
          <div key={index} className="h-21 rounded-card bg-mist motion-safe:animate-pulse" />
        ))}
      </div>
      <div className="flex gap-3.5 max-sm:hidden overflow-hidden lg:grid lg:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))] lg:gap-4">
        {[0, 1, 2, 3].map((index) => (
          <div
            key={index}
            className="h-52 w-67 shrink-0 rounded-card bg-mist motion-safe:animate-pulse sm:w-60 lg:w-auto"
          />
        ))}
      </div>
    </div>
  );
}
