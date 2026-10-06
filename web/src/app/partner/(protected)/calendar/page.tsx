import { PlaceholderBlock } from "@/components/landing/placeholder-block";
import { DisplayTitle } from "@/components/ui/typography";

const PANELS = [
  { title: "Month view", note: "Every listing's bookings and blocked dates, at a glance (M3)" },
  { title: "Block dates", note: "Close a unit or a day when you're unavailable (M3)" },
  { title: "Activity slots", note: "Departure times and how many seats each one has (M3)" },
  { title: "Upcoming", note: "Who's arriving, renting or joining a tour next (M4)" },
];

// The partner calendar: a skeleton until availability exists (M3).
export default function PartnerCalendar() {
  return (
    <main data-testid="partner-calendar" className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-12">
      <DisplayTitle>Calendar</DisplayTitle>
      <div className="grid gap-3 sm:grid-cols-2">
        {PANELS.map((panel) => (
          <PlaceholderBlock key={panel.title} {...panel} />
        ))}
      </div>
    </main>
  );
}
