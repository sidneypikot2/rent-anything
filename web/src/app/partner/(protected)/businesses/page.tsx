import { PlaceholderBlock } from "@/components/landing/placeholder-block";
import { DisplayTitle } from "@/components/ui/typography";

const PANELS = [
  { title: "Your businesses", note: "Each business with its listings and payout account" },
  { title: "Add a business", note: "Start another business from here" },
];

// A skeleton so the tab has somewhere to go, until its page is built.
export default function PartnerBusinesses() {
  return (
    <main data-testid="partner-businesses" className="flex w-full min-w-0 flex-1 flex-col gap-block py-page-pad">
      <DisplayTitle>Businesses</DisplayTitle>
      <div className="grid gap-3 sm:grid-cols-2">
        {PANELS.map((panel) => (
          <PlaceholderBlock key={panel.title} {...panel} />
        ))}
      </div>
    </main>
  );
}
