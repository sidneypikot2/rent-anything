import { PlaceholderBlock } from "@/components/landing/placeholder-block";
import { DisplayTitle } from "@/components/ui/typography";

const PANELS = [
  { title: "Requests to answer", note: "Every booking, by status, with the requests first" },
  { title: "Past and upcoming", note: "Search and filter by dates" },
];

// A skeleton so the tab has somewhere to go, until its page is built.
export default function PartnerBookings() {
  return (
    <main data-testid="partner-bookings" className="flex w-full min-w-0 flex-1 flex-col gap-block py-page-pad">
      <DisplayTitle>Bookings</DisplayTitle>
      <div className="grid gap-3 sm:grid-cols-2">
        {PANELS.map((panel) => (
          <PlaceholderBlock key={panel.title} {...panel} />
        ))}
      </div>
    </main>
  );
}
