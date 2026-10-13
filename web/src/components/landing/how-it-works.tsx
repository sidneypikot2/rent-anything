import Image from "next/image";
import { GlassPanel } from "@/components/ui/glass";
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
const TRUST = [
  { title: "ID checks for partners", body: "A partner verifies their ID before adding a new listing." },
  { title: "Straight from the locals", body: "The people who run the boats, scooters and cottages list them here themselves." },
  { title: "Nothing to pay yet", body: "Saving to a trip is free. Booking and payment are coming soon." },
];

// How the cart works, in three steps, and why the partners can be trusted: a forest-tinted
// photo band with the steps on glass (Sky & Forest, RAA-102).
export function HowItWorks() {
  return (
    <section className="band reveal relative isolate flex flex-col gap-block overflow-hidden rounded-frame p-card text-white sm:p-12">
      <Image src={BAND_PHOTO} alt="" fill sizes="(min-width: 1024px) 64rem, 100vw" className="-z-20 object-cover" />
      <div aria-hidden className="absolute inset-0 -z-10 bg-linear-to-r from-forest/95 via-forest/80 to-forest/55" />
      <div className="grid gap-gutter lg:grid-cols-4">
        <div className="flex flex-col justify-center gap-2 lg:pr-4">
          <p className="text-xs font-bold tracking-[0.14em] text-sky-pale uppercase">How it works</p>
          <h2 className="font-display text-3xl leading-tight font-extrabold tracking-tight text-balance sm:text-4xl">How a trip comes together</h2>
          <p className="text-sky-mist">One trip for every place you visit, planned in one cart.</p>
        </div>
        <ol className="grid gap-gutter sm:grid-cols-3 lg:col-span-3">
          {STEPS.map((step, index) => (
            <li key={step.title}>
              <GlassPanel tone="forest" className="flex h-full flex-col gap-5 rounded-card p-card hover:bg-forest/60">
                <div className="flex items-center justify-between">
                  <StepIcon paths={step.icon} />
                  <span className="rounded-full border border-glass-edge bg-glass-fill px-2.5 py-1 text-xs font-bold tracking-wider uppercase">
                    Step {index + 1}
                  </span>
                </div>
                <div className="flex flex-col gap-1.5">
                  <p className="text-lg font-bold text-pretty">{step.title}</p>
                  <p className="text-sm text-pretty text-sky-mist">{step.body}</p>
                </div>
              </GlassPanel>
            </li>
          ))}
        </ol>
      </div>
      <ul aria-label="Why book here" className="grid gap-gutter border-t border-glass-edge pt-block sm:grid-cols-3">
        {TRUST.map((point) => (
          <li key={point.title}>
            <p className="font-semibold">{point.title}</p>
            <p className="text-sm text-pretty text-sky-mist">{point.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

// A step's icon in a glowing glass square: the light sky fill shows through the white lines.
function StepIcon({ paths }: { paths: { fill: string[]; line: string[] } }) {
  return (
    <span className="relative isolate flex size-14 items-center justify-center rounded-control border border-glass-edge bg-linear-to-br from-white/30 to-white/5 shadow-lift inset-shadow-xs inset-shadow-white/40">
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
