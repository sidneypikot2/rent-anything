import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SectionTitle } from "@/components/ui/typography";

// What the cart does, shown rather than listed (RAA-73): one example trip across two
// destinations, drawn like a trip in /cart. Since RAA-75 it is the home hero's picture, set
// on Bantayan Island, where the platform launches. Static — nothing here is a real booking.
const EXAMPLE = {
  name: "Bantayan in March",
  details: "12–15 Mar · 2 guests · 4 items",
  stops: [
    { area: "Cebu City", items: [{ title: "Van transfer to Hagnaya port", when: "12 Mar" }] },
    {
      area: "Santa Fe, Bantayan Island",
      items: [
        { title: "Beach cottage", when: "12–15 Mar" },
        { title: "Scooter rental", when: "13–14 Mar" },
        { title: "Island hopping tour", when: "14 Mar" },
      ],
    },
  ],
};

export function ExampleTripCard({ className }: { className?: string }) {
  return (
    <Card role="group" aria-label="An example trip" className={className}>
      <div className="flex items-start justify-between gap-3 border-b border-line p-4">
        <div className="min-w-0">
          <p className="font-display text-2xl font-bold italic leading-tight">{EXAMPLE.name}</p>
          <p className="text-sm text-muted">{EXAMPLE.details}</p>
        </div>
        <Badge tone="mist">Example</Badge>
      </div>
      <ul className="divide-y divide-line">
        {EXAMPLE.stops.map((stop) => (
          <li key={stop.area} className="px-4 py-3">
            <p className="text-sm font-semibold text-primary">{stop.area}</p>
            <ul className="mt-1">
              {stop.items.map((item) => (
                <li key={item.title} className="flex items-baseline justify-between gap-3 py-1.5">
                  <span className="font-medium">{item.title}</span>
                  <span className="shrink-0 text-sm text-muted">{item.when}</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      <p className="border-t border-line bg-surface-2 px-4 py-3 text-sm text-muted">Planning · book when you&apos;re ready</p>
    </Card>
  );
}

const STEPS = [
  { title: "Start from a place or a passion", body: "Search a destination, a landmark or something you love doing." },
  { title: "Add what you need there", body: "Tours, rides, gear and stays from local partners." },
  { title: "Keep every stop together", body: "Each trip holds its places and dates, even when it spans islands." },
];

// What a traveller can rely on before booking anything. Only what is true today: partners
// pass an ID check before they can list (Listings::Create), and nothing can be paid yet.
const TRUST = [
  { title: "Every partner is ID-checked", body: "Partners verify their ID before they can list anything." },
  { title: "Straight from the locals", body: "The people who run the boats, scooters and cottages list them here themselves." },
  { title: "Nothing to pay yet", body: "Saving to a trip is free. Booking and payment are coming soon." },
];

// How the cart works, in three steps, and why the partners can be trusted.
export function HowItWorks() {
  return (
    <section className="flex flex-col gap-6">
      <SectionTitle>How a trip comes together</SectionTitle>
      <ol className="grid gap-6 sm:grid-cols-3">
        {STEPS.map((step, index) => (
          <li key={step.title} className="flex gap-3">
            <span
              aria-hidden
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-mist font-display text-lg font-bold text-primary"
            >
              {index + 1}
            </span>
            <div>
              <p className="font-semibold">{step.title}</p>
              <p className="text-sm text-pretty text-muted">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <ul aria-label="Why book here" className="grid gap-4 rounded-2xl bg-surface-2 p-5 sm:grid-cols-3">
        {TRUST.map((point) => (
          <li key={point.title}>
            <p className="font-semibold text-primary">{point.title}</p>
            <p className="text-sm text-pretty text-muted">{point.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
