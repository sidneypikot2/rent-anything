import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { GlassPanel } from "@/components/ui/glass";
import { Section } from "@/components/ui/section";
import { BAND_PHOTO } from "./sample-photos";

// Each step's icon: a soft filled shape (`fill`) under the line drawing (`line`).
const STEPS = [
  {
    title: "Start from a place or a passion",
    body: "Search a destination, a landmark or something you love doing.",
    icon: {
      fill: ["M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11Z"],
      line: ["M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11Z", "M9.5 10a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0"],
    },
  },
  {
    title: "Add what you need there",
    body: "Tours, rides, gear and stays from local partners.",
    icon: {
      fill: ["M5 8h14l-1 12H6Z"],
      line: ["M5 8h14l-1 12H6Z", "M9 8a3 3 0 0 1 6 0", "M12 12v4", "M10 14h4"],
    },
  },
  {
    title: "Keep every stop together",
    body: "Each trip holds its places and dates, even when it spans islands.",
    icon: {
      fill: ["M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0"],
      line: ["M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0", "M8 12.5l2.5 2.5 5.5-5.5"],
    },
  },
];

// What a traveller can rely on before booking anything. Only what is true today: a partner
// passes an ID check before adding a listing (Listings::Create) — the sample partners seeded
// before that check weren't, so it doesn't promise "every" — and nothing can be paid yet.
// `short` is the point's line under the home hero's search; the one source keeps them agreeing.
export const TRUST: { title: string; body: string; short?: string }[] = [
  {
    title: "ID checks for partners",
    body: "A partner verifies their ID before adding a new listing.",
    short: "ID check before listing",
  },
  { title: "Straight from the locals", body: "The people who run the boats, scooters and cottages list them here themselves." },
  {
    title: "Nothing to pay yet",
    body: "Saving to a trip is free. Booking and payment are coming soon.",
    short: "Nothing to pay yet",
  },
];

// How the cart works, in three steps, and why the partners can be trusted: a forest-tinted
// photo band with the steps on glass (Sky & Forest, RAA-102). It is a Section, so it is headed
// like the rest; the page's glass rules give its eyebrow and intro their light colours. The steps
// ease in in their order.
export function HowItWorks() {
  return (
    <Section
      eyebrow="How it works"
      title="How a trip comes together"
      intro="One trip for every place you visit, planned in one cart."
      className="band relative isolate overflow-hidden rounded-frame p-card text-white sm:p-12"
    >
      <Image src={BAND_PHOTO} alt="" fill sizes="(min-width: 72rem) 72rem, 100vw" className="-z-20 object-cover" />
      <div aria-hidden className="absolute inset-0 -z-10 bg-linear-to-r from-forest/95 via-forest/80 to-forest/55" />
      {/* The trust points are small text at the foot, where the scrim above is lightest on the
          right: a second scrim darkens the foot so they read on any photo. */}
      <div aria-hidden className="absolute inset-x-0 bottom-0 -z-10 h-1/2 bg-linear-to-t from-forest/80 to-transparent" />
      {/* On a phone each step is a row, its icon beside the words, and the words drop under the
          icon when enlarged text leaves them under 10rem; from sm up the steps stand side by
          side, the icon above. */}
      <ol className="reveal-steps grid gap-3 sm:grid-cols-3 sm:gap-gutter">
        {STEPS.map((step, index) => (
          <li key={step.title} className="min-w-0">
            <GlassPanel tone="forest" className="flex h-full gap-4 rounded-card p-5 max-sm:flex-wrap sm:flex-col sm:gap-5 sm:p-card">
              <div className="flex shrink-0 items-start justify-between sm:items-center">
                <StepIcon paths={step.icon} />
                <span className="hidden sm:block">
                  <StepBadge number={index + 1} />
                </span>
              </div>
              <div className="flex min-w-0 flex-col items-start gap-1.5 max-sm:flex-1 max-sm:basis-40">
                <span className="sm:hidden">
                  <StepBadge number={index + 1} />
                </span>
                <h3 className="text-lg font-bold text-pretty">{step.title}</h3>
                <p className="text-sm text-pretty text-sky-mist">{step.body}</p>
              </div>
            </GlassPanel>
          </li>
        ))}
      </ol>
      <ul aria-label="What you can rely on" className="grid gap-gutter border-t border-glass-edge pt-block sm:grid-cols-3">
        {TRUST.map((point) => (
          <li key={point.title}>
            <p className="font-semibold">{point.title}</p>
            <p className="text-sm text-pretty text-sky-mist">{point.body}</p>
          </li>
        ))}
      </ul>
    </Section>
  );
}

// Its visibility goes on a wrapper: Badge's own inline-flex would win over a hidden passed in.
// Hidden from screen readers: the list already numbers the steps, so it would say "1. Step 1".
function StepBadge({ number }: { number: number }) {
  return (
    <Badge tone="glass" aria-hidden className="whitespace-nowrap">
      Step {number}
    </Badge>
  );
}

// A step's icon in a glowing glass square: the light sky fill shows through the white lines.
function StepIcon({ paths }: { paths: { fill: string[]; line: string[] } }) {
  return (
    <span className="relative isolate flex size-14 items-center justify-center rounded-control border border-glass-edge bg-linear-to-br from-glass-hover to-glass-fill shadow-lift inset-shadow-xs inset-shadow-white/40">
      <span aria-hidden className="absolute inset-2 -z-10 rounded-full bg-sky-pale/30 blur-md" />
      <svg viewBox="0 0 24 24" aria-hidden className="size-7">
        {paths.fill.map((d) => (
          <path key={d} d={d} className="fill-sky-pale/35" />
        ))}
        {paths.line.map((d) => (
          <path
            key={d}
            d={d}
            fill="none"
            className="stroke-white"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </svg>
    </span>
  );
}
