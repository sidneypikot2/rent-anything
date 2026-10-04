import type { Metadata } from "next";
import { PlaceholderBlock } from "@/components/landing/placeholder-block";
import { DisplayTitle } from "@/components/ui/typography";

export const metadata: Metadata = {
  title: "Partners · Rent-Anything",
};

const PANELS = [
  { title: "ID verification", note: "Government ID and a selfie (M5)" },
  { title: "Listings", note: "What you offer, with photos and prices (M2)" },
  { title: "Calendar", note: "Block dates and see bookings (M3)" },
  { title: "Payouts", note: "Completed bookings, minus commission (M4)" },
];

// The partner home, signed-in partners only. Placeholder panels until the partner tools
// exist.
export default function PartnerHome() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-12">
      <DisplayTitle>Partner dashboard</DisplayTitle>
      <div data-testid="partner-dashboard" className="grid gap-3 sm:grid-cols-2">
        {PANELS.map((panel) => (
          <PlaceholderBlock key={panel.title} {...panel} />
        ))}
      </div>
    </main>
  );
}
