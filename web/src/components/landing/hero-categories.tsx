"use client";

import Link from "next/link";
import { GROUP_ICON, TRIP_ORDER_GROUPS } from "@/components/discovery/categories";
import { CategoryGlyph, PlaceGlyph } from "@/components/discovery/tag-glyphs";
import { withDates } from "@/components/trips/trip-dates";
import { cn } from "@/components/ui/cn";
import { useHeroTrip } from "./hero-trip";

// The home hero's kinds of things to book (RAA-130): each opens What to book on its group
// (`?show=`, the area page's trip needs) at the destination in Where, or the launch area when
// Where holds none, with the dates and guests already in the search. The label names that
// destination, so where a pill goes is never a guess.
// One per group, in the order a trip needs them (TRIP_ORDER_GROUPS), each named as the area
// page's group it opens, shortened.
// Shortcuts, a quiet text row under the search (RAA-130 critique): no outline and no fill, so the
// search's blue button stays the first screen's one main action and these read as a side door to
// the same place, not a second way in competing with it. Underlined at rest, faintly (solid on
// hover), as plain white words read as labels rather than links (2026-10-30); no hover fill, which
// boxed the underline in, and one even gap between links rather than each link's own padding. Each link keeps a tap target's height
// (min-h-11) and its icon in the group's hue, as on the area map's pins. One line from sm, the
// label leading; on a phone the label sits over the four. A phone on its side drops the label (the
// nav still names the place, and Where shows it).
export function HeroCategories() {
  const { carry, area } = useHeroTrip();
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4">
      <p className="flex min-w-0 items-center gap-1.5 text-sm text-sky-mist landscape-phone:hidden">
        <PlaceGlyph className="size-4 shrink-0" />
        <span className="min-w-0 truncate">
          Or browse <span className="font-semibold text-white">{area.name}</span>:
        </span>
      </p>
      <nav
        aria-label={`Things to book in ${area.name}`}
        // One row to swipe on a phone, fading at its right edge, rather than wrapping three over two.
        className="cascade flex gap-x-4 [--cascade:slide-in] max-sm:overflow-x-auto max-sm:pr-8 max-sm:[scrollbar-width:none] max-sm:[mask-image:linear-gradient(to_right,black_calc(100%-2rem),transparent)] sm:flex-wrap sm:gap-x-5"
      >
        {TRIP_ORDER_GROUPS.map((pill) => (
          <Link
            key={pill.id}
            href={withDates(`/${area.slug}?show=${pill.id}#listings`, carry)}
            className="flex min-h-11 shrink-0 items-center gap-1.5 text-sm font-semibold whitespace-nowrap text-white underline decoration-white/45 decoration-1 underline-offset-4 transition-colors duration-300 ease-calm hover:decoration-white"
          >
            <CategoryGlyph name={pill.icon} className={cn("size-4 shrink-0", GROUP_ICON[pill.group])} />
            {pill.short}
          </Link>
        ))}
      </nav>
    </div>
  );
}
