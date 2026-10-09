import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SectionTitle } from "@/components/ui/typography";

// What the cart does, shown rather than listed (RAA-73): one example trip across two
// destinations, drawn like a trip in /cart. Static — nothing here is a real booking.
const EXAMPLE = {
  name: "Cebu in March",
  details: "12–15 Mar · 2 guests · 3 items",
  stops: [
    {
      area: "Bantayan Island",
      items: [
        { title: "Island hopping tour", when: "Thu 12 Mar" },
        { title: "Scooter rental", when: "12–14 Mar" },
      ],
    },
    { area: "Cebu City", items: [{ title: "Heritage walk", when: "Sun 15 Mar" }] },
  ],
};

const NOTES = [
  { title: "Start from a place or a passion", body: "Search a destination, a landmark or something you love doing." },
  { title: "Add what you need there", body: "Tours, rides, gear and stays from local, ID-checked partners." },
  {
    title: "One cart, every stop",
    body: "Each trip keeps its places and dates together. Booking and payment are coming soon.",
  },
];

export function ExampleTrip() {
  return (
    <section className="grid items-center gap-8 lg:grid-cols-[1fr_1.1fr]">
      <div className="flex flex-col gap-6">
        <SectionTitle>How a trip comes together</SectionTitle>
        <ol className="flex flex-col gap-4">
          {NOTES.map((note) => (
            <li key={note.title}>
              <p className="font-semibold">{note.title}</p>
              <p className="text-sm text-pretty text-muted">{note.body}</p>
            </li>
          ))}
        </ol>
      </div>

      <Card role="group" aria-label="An example trip">
        <div className="flex items-start justify-between gap-3 border-b border-line p-4">
          <div className="min-w-0">
            <p className="font-display text-2xl font-bold italic leading-tight">{EXAMPLE.name}</p>
            <p className="text-sm text-muted">{EXAMPLE.details}</p>
          </div>
          <Badge tone="mist">Example</Badge>
        </div>
        <ul className="flex flex-col gap-4 bg-surface-2 p-4">
          {EXAMPLE.stops.map((stop) => (
            <li key={stop.area}>
              <p className="text-sm font-semibold text-primary">{stop.area}</p>
              <ul className="mt-1 divide-y divide-line rounded-xl border-[1.5px] border-line bg-surface">
                {stop.items.map((item) => (
                  <li key={item.title} className="flex items-center justify-between gap-3 px-3 py-2.5">
                    <span className="font-medium">{item.title}</span>
                    <span className="shrink-0 text-sm text-muted">{item.when}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
        <p className="border-t border-line px-4 py-3 text-sm text-muted">Planning · book when you&apos;re ready</p>
      </Card>
    </section>
  );
}
