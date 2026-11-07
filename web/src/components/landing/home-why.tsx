import type { ReactNode } from "react";
import { BagGlyph, CategoryGlyph, CheckGlyph, CompassGlyph } from "@/components/discovery/tag-glyphs";
import { cn } from "@/components/ui/cn";
import { BRAND } from "@/lib/brand";

// Only what is true today: no reviews, deals or free cancellation yet, every listing is request
// to book, and a partner verifies their ID before adding a listing (Listings::Create) — the
// sample partners seeded before that check weren't, so it never says "every" (as How it works).
const POINTS: { title: string; body: string; art: ReactNode }[] = [
  {
    title: "Your whole trip in one cart",
    body: "Stays, tours, rides and transfers, grouped into one trip that keeps your dates.",
    art: <Spot blob="bg-sky-pale" dot="bg-sun/60" glyph={<BagGlyph className="size-10 text-cerulean" />} />,
  },
  {
    title: "Straight from local partners",
    body: "Rental shops, tour operators and guesthouses on the island list here themselves.",
    art: (
      <Spot
        blob="bg-mint/35"
        dot="bg-cerulean/30"
        glyph={<CategoryGlyph name="Hotel or cottage" className="size-10 text-emerald" />}
      />
    ),
  },
  {
    title: "Plan it, or just book one thing",
    body: "A guide builds the whole trip with you, or pick the one thing you need. Planning is free.",
    art: <Spot blob="bg-action-tint" dot="bg-aqua/60" glyph={<CompassGlyph className="size-10 text-action" />} />,
  },
  {
    title: "Partners who show their ID",
    body: "Partners verify their ID before they list something new. We're on the island if you need us.",
    art: <Spot blob="bg-sun/25" dot="bg-mint/50" glyph={<CheckGlyph className="size-10 text-forest" />} />,
  },
];

// "Why TripKoNext" (after Klook's "Why choose Klook", 2026-11-07): four reasons to plan here, each
// under a small spot drawing, last on the home's white sheet. One column on a phone, two from sm,
// four from lg.
export function HomeWhy() {
  return (
    <section aria-labelledby="home-why" className="flex flex-col gap-block border-t border-line pt-6 sm:pt-7">
      <h2 id="home-why" className="font-display text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
        Why {BRAND}
      </h2>
      <ul className="grid gap-5 sm:grid-cols-2 sm:gap-gutter lg:grid-cols-4">
        {POINTS.map((point) => (
          <li key={point.title} className="flex gap-4 sm:flex-col sm:gap-3">
            {point.art}
            <div className="flex min-w-0 flex-col gap-1">
              <h3 className="font-display text-title-sm leading-snug font-extrabold tracking-tight text-foreground text-pretty">
                {point.title}
              </h3>
              <p className="text-sm leading-relaxed text-pretty text-muted">{point.body}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

// A spot drawing: a soft tilted blob, a small dot of a second hue behind its corner, and the
// glyph in front, a little off centre, so it reads as a drawing rather than an icon button.
function Spot({ blob, dot, glyph }: { blob: string; dot: string; glyph: ReactNode }) {
  return (
    <span aria-hidden className="relative grid size-20 shrink-0 place-items-center">
      <span className={cn("absolute inset-1 -rotate-12 rounded-[40%_60%_55%_45%]", blob)} />
      <span className={cn("absolute top-0.5 right-0.5 size-6 rounded-full", dot)} />
      <span className="relative translate-x-0.5 -translate-y-0.5">{glyph}</span>
    </span>
  );
}
