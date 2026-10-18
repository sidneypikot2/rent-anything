import type { ReactNode } from "react";
import { GROUP_ICON } from "@/components/discovery/categories";
import { CategoryGlyph, CheckGlyph } from "@/components/discovery/tag-glyphs";
import { cn } from "@/components/ui/cn";
import { GlassPanel, glassClasses } from "@/components/ui/glass";
import { LAUNCH_AREA } from "./launch-area";
import { Section } from "@/components/ui/section";

const STEPS = [
  {
    title: "Start from a place",
    body: "Search a destination, a landmark or something you love doing.",
  },
  {
    title: "Add what you need there",
    // The kinds are named in the hero, the example trip and the listings above; this says what
    // adding does instead.
    body: "Pick your dates once: everything you add keeps them.",
  },
  {
    title: "Keep every stop together",
    body: "Each trip holds its places and dates, even when it spans islands.",
  },
];

// What a traveller can rely on before booking anything. Only what is true today: a partner
// passes an ID check before adding a listing (Listings::Create) — the sample partners seeded
// before that check weren't, so it doesn't promise "every" — partners publish their own listings,
// with no review, and nothing can be paid yet. Not "the island": the page offers cities too.
// A phone shows the titles alone, so each title is true without its body (PRODUCT.md's wording).
const TRUST: { title: string; body: string }[] = [
  {
    title: "Partners pass an ID check before listing",
    body: "A partner verifies their ID before adding something new to book.",
  },
  { title: "Straight from local partners", body: "Rental shops, tour operators and guesthouses list here themselves." },
  {
    title: "Saving a trip is free",
    body: "Nothing to pay while you plan. You'll pay only when you book, once booking opens.",
  },
];

// One trip as the cart holds it, to show rather than tell what "in one cart" means: a stop's
// transfers there and back, stay, ride and tour together, each with its day. It is an example, and says so; it
// names a real town and the real way there — Cebu's airport, the van to Hagnaya port and its
// ferry — but no partner and no price, since nothing can be booked or paid yet. No status badge:
// "Planning" is the cart's word for every trip until checkout exists (RAA-68), and means nothing
// to someone who hasn't made one.
const EXAMPLE_ITEMS: { name: string; meta: string; when: string; icon: string; group: keyof typeof GROUP_ICON }[] = [
  { name: "Van transfer", meta: "Cebu airport to Hagnaya port, for the ferry", when: "Day 1", icon: "Van transfer", group: "transfer" },
  { name: "Cottage in Santa Fe", meta: "Stay", when: "3 nights", icon: "Hotel or cottage", group: "stay" },
  { name: "Scooter", meta: "Rental", when: "Days 1–4", icon: "Motorcycle", group: "rental" },
  { name: "Island hopping", meta: "Activity", when: "Day 2", icon: "Tour", group: "activity" },
  { name: "Van transfer back", meta: "Hagnaya port to Cebu airport", when: "Day 4", icon: "Van transfer", group: "transfer" },
];

// How the cart works (RAA-130), after the partners' listings. Below xl
// the example trip leads, so a phone reaches the proof before the explanation; from xl the
// hero shows it beside its search instead. Then the three steps and the trust points, each led
// by a mint tick, under a rule on one panel of dark glass: small text on the bare photo would
// depend on what the photo has behind it. A phone gets each step's and trust point's title
// alone, which says enough (the hero's note already says booking isn't open). Like the other guest browse sections it has no eyebrow (RAA-125). The steps ease in
// in their order. From md to xl the example trip and the panel sit side by side, the steps
// stacked, so the trip's narrow card doesn't leave half the row empty; from xl, with the trip in
// the hero, the panel takes the width and the steps go three across.
export function HowItWorks() {
  return (
    <Section
      surface="photo"
      title="How a trip comes together"
    >
      <div className="flex flex-col gap-block md:grid md:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] md:gap-gutter xl:block">
        <ExampleTrip className="max-w-lg xl:hidden" />
        <div className={cn(glassClasses("dark"), "flex flex-col gap-5 rounded-card p-5 sm:gap-6 sm:p-card")}>
          <ol className="reveal-steps flex flex-col gap-4 sm:gap-5 xl:grid xl:grid-cols-3 xl:gap-gutter">
            {STEPS.map((step, index) => (
              // A phone shows the title alone, one line beside its number, so it centres on it. From
              // xl the steps hang on one dashed rail, as the hero search's steps do: one trip, in order.
              <li key={step.title} className="flex gap-3.5 max-sm:items-center xl:flex-col xl:gap-3">
                <span aria-hidden className="flex items-center gap-3">
                  {/* The list numbers the steps for a screen reader already. */}
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-aqua font-display font-extrabold text-navy">
                    {index + 1}
                  </span>
                  {index < STEPS.length - 1 && (
                    <span className="hidden h-px flex-1 border-t border-dashed border-sky-mist/50 xl:block" />
                  )}
                </span>
                <div className="flex min-w-0 flex-col gap-1">
                  <h3 className="text-title-sm leading-snug font-extrabold tracking-tight text-pretty">{step.title}</h3>
                  <p className="text-sm leading-relaxed text-pretty text-sky-mist max-sm:hidden">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <ul
            aria-label="What you can rely on"
            className="grid gap-3 border-t border-glass-edge pt-5 text-sm sm:grid-cols-3 sm:gap-gutter md:grid-cols-1 md:gap-3 xl:grid-cols-3 xl:gap-gutter"
          >
            {TRUST.map((point) => (
              <li key={point.title} className="flex gap-2">
                <CheckGlyph className="mt-0.5 size-4.5 shrink-0 text-mint" />
                <span className="flex flex-col">
                  <span className="font-semibold text-white">{point.title}</span>
                  <span className="leading-relaxed text-pretty text-sky-mist max-sm:hidden">{point.body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Section>
  );
}

// The hero's aside from xl (`compact`, tighter for its 20rem column), and How it works' below it.
// A guest with a trip planning sees their own in the hero's place instead (HeroAside).
export function ExampleTrip({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <TripCard
      compact={compact}
      className={className}
      title={`${LAUNCH_AREA.name} long weekend`}
      details="3 nights · 2 guests"
      items={EXAMPLE_ITEMS.map((item) => ({ ...item, key: item.name }))}
      caption="An example trip. Yours fills in as you add to it."
    />
  );
}

export type TripCardItem = { key: string | number; name: string; meta: string; when: string; icon: string; group: keyof typeof GROUP_ICON };

// A trip as a card: its title and size, then its items on one rail, first stop to last, and a
// caption at its foot.
export function TripCard({
  compact = false,
  className,
  title,
  details,
  items,
  caption,
}: {
  compact?: boolean;
  className?: string;
  title: string;
  details: string;
  items: TripCardItem[];
  caption: ReactNode;
}) {
  return (
    <figure className={cn("m-0", className)}>
      {/* In the hero it rests (shadow-soft) beside the search, which floats: the search is the
          first thing to look at, the trip the proof beside it. */}
      <GlassPanel tone="card" className={cn("flex flex-col rounded-card", compact ? "gap-3 p-5 shadow-soft" : "gap-4 p-5 shadow-float sm:p-card")}>
        <div className="min-w-0">
          <p className={cn("font-display font-extrabold tracking-tight", compact ? "text-lg leading-snug" : "text-xl")}>
            {title}
          </p>
          <p className="text-sm text-sky-mist">{details}</p>
        </div>
        {/* The items hang on one rail through their icons, first stop to last, so the card reads as
            a trip in order rather than a list of purchases. */}
        <ul className={cn("flex flex-col border-t border-glass-edge", compact ? "pt-1" : "pt-2")}>
          {items.map((item) => (
            <li key={item.key} className={cn("group flex items-stretch", compact ? "gap-2.5" : "gap-3")}>
              <span aria-hidden className="flex shrink-0 flex-col items-center">
                <span className={cn("w-px flex-1 bg-sky-mist/40 group-first:invisible", compact ? "min-h-2 fold:min-h-1.5" : "min-h-2.5")} />
                <span className={cn("grid shrink-0 place-items-center rounded-control border border-glass-edge bg-navy/40", compact ? "size-10" : "size-11")}>
                  <CategoryGlyph name={item.icon} className={cn("size-5", GROUP_ICON[item.group])} />
                </span>
                <span className={cn("w-px flex-1 bg-sky-mist/40 group-last:invisible", compact ? "min-h-2 fold:min-h-1.5" : "min-h-2.5")} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col justify-center">
                <span className={cn("leading-snug font-semibold text-pretty", compact && "line-clamp-2")}>{item.name}</span>
                {/* A laptop's short window drops it from the hero's card, which would otherwise stand
                    taller than the title and search beside it and push into the photo's top. */}
                {/* A phone keeps only the transfers' routes: the other lines name the kind, which
                    the icon already shows. */}
                <span
                  className={cn(
                    "text-sm leading-snug text-pretty text-sky-mist",
                    compact && "fold:hidden",
                    item.group !== "transfer" && "max-sm:hidden",
                  )}
                >
                  {item.meta}
                </span>
              </span>
              <span className="shrink-0 self-center text-sm font-bold whitespace-nowrap text-white tabular-nums">{item.when}</span>
            </li>
          ))}
        </ul>
        {/* At the card's foot, not as a label over its title (the example reads as one) nor on a
            chip of its own under it, which looked like a button. */}
        <figcaption className={cn("border-t border-glass-edge text-sm text-sky-mist", compact ? "pt-2.5" : "pt-3")}>
          {caption}
        </figcaption>
      </GlassPanel>
    </figure>
  );
}
