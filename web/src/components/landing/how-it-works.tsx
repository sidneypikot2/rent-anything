import { CheckGlyph } from "@/components/discovery/tag-glyphs";
import { GlassPanel } from "@/components/ui/glass";
import { Section } from "@/components/ui/section";

const STEPS = [
  {
    title: "Start from a place or a passion",
    body: "Search a destination, a landmark or something you love doing.",
  },
  {
    title: "Add what you need there",
    body: "Tours, rides, gear and stays from local partners.",
  },
  {
    title: "Keep every stop together",
    body: "Each trip holds its places and dates, even when it spans islands.",
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

// How the cart works, in three steps, and why the partners can be trusted (RAA-130): a section
// on the bare photo like Destinations, each step a numbered card on dark glass, and the trust
// points under a rule, each led by a mint tick. The steps ease in in their order.
export function HowItWorks() {
  return (
    <Section
      surface="photo"
      eyebrow="How it works"
      title="How a trip comes together"
      intro="One trip for every place you visit, planned in one cart."
    >
      <ol className="reveal-steps grid gap-3 sm:grid-cols-3 sm:gap-4">
        {STEPS.map((step, index) => (
          <li key={step.title} className="min-w-0">
            <GlassPanel tone="card" className="flex h-full gap-3.5 rounded-card p-4.5">
              {/* The list numbers the steps for a screen reader already. */}
              <span
                aria-hidden
                className="flex size-9 shrink-0 items-center justify-center rounded-control bg-aqua font-display font-extrabold text-navy"
              >
                {index + 1}
              </span>
              <div className="flex min-w-0 flex-col gap-1">
                <h3 className="text-[1.0625rem] leading-snug font-extrabold tracking-tight text-pretty">{step.title}</h3>
                <p className="text-sm text-pretty text-sky-mist">{step.body}</p>
              </div>
            </GlassPanel>
          </li>
        ))}
      </ol>
      <ul
        aria-label="What you can rely on"
        className="mx-inset grid gap-gutter border-t border-glass-edge pt-4 text-sm sm:grid-cols-3 sm:pt-5"
      >
        {TRUST.map((point) => (
          <li key={point.title} className="flex gap-2">
            <CheckGlyph className="mt-0.5 size-4.5 shrink-0 text-mint" />
            <span className="flex flex-col">
              <span className="font-semibold text-white">{point.title}</span>
              <span className="text-pretty text-sky-mist">{point.body}</span>
            </span>
          </li>
        ))}
      </ul>
    </Section>
  );
}
