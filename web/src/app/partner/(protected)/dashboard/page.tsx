"use client";

import { Suspense } from "react";
import { PlaceholderBlock } from "@/components/landing/placeholder-block";
import { BookingRequests } from "@/components/partner/booking-requests";
import { usePartnerRequests } from "@/components/partner/use-partner-calendar";
import { Card, CardBody } from "@/components/ui/card";
import { DisplayTitle, SectionTitle } from "@/components/ui/typography";
import { useSession } from "@/lib/auth/session";

const STATS = ["Bookings this month", "Pending requests", "Active listings", "Payouts due"];

const PANELS = [
  { title: "ID verification", note: "Government ID and a selfie, checked by Didit before you list" },
  { title: "Listings", note: "What you offer, with photos and prices (M2)" },
  { title: "Calendar", note: "Block dates and see what's booked (M3)" },
  { title: "Payouts", note: "Completed bookings, minus commission (M4)" },
];

// The partner dashboard: where partners land after signing in, and where a request email
// brings them (RAA-261). Requests to answer come first; the rest is a skeleton until the partner
// tools exist, and a stat reads "—" until there is data behind it.
export default function PartnerDashboard() {
  const session = useSession();
  const requests = usePartnerRequests();

  return (
    <main data-testid="partner-dashboard" className="mx-auto flex w-full max-w-page flex-1 flex-col gap-block px-gutter py-page-pad">
      <DisplayTitle>Hi, {session?.user.name ?? session?.user.email}</DisplayTitle>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {STATS.map((label) => (
          <Card key={label}>
            <CardBody>
              <p className="text-xs text-muted">{label}</p>
              <p className="mt-1 font-display text-3xl font-bold">{label === "Pending requests" ? (requests.data?.length ?? "—") : "—"}</p>
            </CardBody>
          </Card>
        ))}
      </div>

      {/* It reads ?booking= (useSearchParams), so it renders in the browser only. */}
      <Suspense>
        <BookingRequests />
      </Suspense>

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
