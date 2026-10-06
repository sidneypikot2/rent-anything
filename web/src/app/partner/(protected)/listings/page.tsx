import { PlaceholderBlock } from "@/components/landing/placeholder-block";
import { DisplayTitle } from "@/components/ui/typography";

const PANELS = [
  { title: "Your listings", note: "Everything you offer, draft or published (M2)" },
  { title: "Add a listing", note: "Category, photos, details and where it is (M2)" },
  { title: "Pricing", note: "Hourly, daily and weekly rates, or a price per seat (M2)" },
  { title: "Units", note: "How many of each you have: five pairs of fins is one listing, five units (M3)" },
];

// The partner's listings: a skeleton until listing management exists (M2).
export default function PartnerListings() {
  return (
    <main data-testid="partner-listings" className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-12">
      <DisplayTitle>Listings</DisplayTitle>
      <div className="grid gap-3 sm:grid-cols-2">
        {PANELS.map((panel) => (
          <PlaceholderBlock key={panel.title} {...panel} />
        ))}
      </div>
    </main>
  );
}
