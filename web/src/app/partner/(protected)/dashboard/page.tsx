"use client";

import { PlaceholderBlock } from "@/components/landing/placeholder-block";
import { Card, CardBody } from "@/components/ui/card";
import { DisplayTitle, SectionTitle } from "@/components/ui/typography";
import { useSession } from "@/lib/auth/session";

const STATS = ["Bookings this month", "Pending requests", "Active listings", "Payouts due"];

const PANELS = [
  { title: "ID verification", note: "Government ID and a selfie, reviewed by our team (M5)" },
  { title: "Listings", note: "What you offer, with photos and prices (M2)" },
  { title: "Booking requests", note: "Accept or decline request-to-book items (M4)" },
  { title: "Calendar", note: "Block dates and see what's booked (M3)" },
  { title: "Payouts", note: "Completed bookings, minus commission (M4)" },
];

// The partner dashboard: where partners land after signing in. A skeleton until the
// partner tools exist; the stats read "—" until there is data behind them.
export default function PartnerDashboard() {
  const session = useSession();

  return (
    <main data-testid="partner-dashboard" className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-12">
      <DisplayTitle>Hi, {session?.user.name}</DisplayTitle>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {STATS.map((label) => (
          <Card key={label}>
            <CardBody>
              <p className="text-xs text-muted">{label}</p>
              <p className="mt-1 font-display text-3xl font-bold">—</p>
            </CardBody>
          </Card>
        ))}
      </div>

      <section className="flex flex-col gap-3">
        <SectionTitle>Your business</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          {PANELS.map((panel) => (
            <PlaceholderBlock key={panel.title} {...panel} />
          ))}
        </div>
      </section>
    </main>
  );
}
