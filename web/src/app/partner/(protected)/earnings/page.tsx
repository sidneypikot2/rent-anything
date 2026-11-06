import { PlaceholderBlock } from "@/components/landing/placeholder-block";
import { DisplayTitle } from "@/components/ui/typography";

const PANELS = [
  { title: "This month", note: "An estimate of what each booking pays out" },
  { title: "Offline bookings", note: "Bookings you took yourself, listed apart" },
];

// A skeleton so the tab has somewhere to go, until its page is built.
export default function PartnerEarnings() {
  return (
    <main data-testid="partner-earnings" className="flex w-full min-w-0 flex-1 flex-col gap-block py-page-pad">
      <DisplayTitle>Earnings</DisplayTitle>
      <div className="grid gap-3 sm:grid-cols-2">
        {PANELS.map((panel) => (
          <PlaceholderBlock key={panel.title} {...panel} />
        ))}
      </div>
    </main>
  );
}
