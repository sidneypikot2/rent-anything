"use client";

import { Suspense } from "react";
import { BookingRequests } from "@/components/partner/booking-requests";
import { DashboardTiles } from "@/components/partner/dashboard/dashboard-tiles";
import { NeedsAttention } from "@/components/partner/dashboard/needs-attention";
import { RecentActivity } from "@/components/partner/dashboard/recent-activity";
import { UpcomingBookings } from "@/components/partner/dashboard/upcoming-bookings";
import { useBookingSheet } from "@/components/partner/dashboard/use-booking-sheet";
import { usePartnerDashboard } from "@/components/partner/use-partner-dashboard";
import { DisplayTitle } from "@/components/ui/typography";
import { useSession } from "@/lib/auth/session";

// The partner dashboard: where partners land after signing in, and where a request email
// brings them (RAA-261). From GET /partner/dashboard (RAA-266, RAA-284): the day's figures, the
// requests to answer first (they expire), then what else needs the partner (setup, listings not
// live), the bookings coming up and what changed lately.
export default function PartnerDashboard() {
  const session = useSession();
  const { data, isError } = usePartnerDashboard();
  const sheet = useBookingSheet();

  return (
    <main data-testid="partner-dashboard" className="flex w-full min-w-0 flex-1 flex-col gap-section py-page-pad">
      <div className="flex flex-col gap-block">
        <DisplayTitle>Hi, {session?.user.name ?? session?.user.email}</DisplayTitle>
        <DashboardTiles tiles={data?.tiles} />
        {isError && (
          <p role="alert" className="text-sm text-danger">
            The dashboard couldn&apos;t load. Refresh the page to try again.
          </p>
        )}
      </div>

      {/* It reads ?booking= (useSearchParams), so it renders in the browser only. */}
      <Suspense>
        <BookingRequests />
      </Suspense>

      {data && <NeedsAttention data={data} />}

      {data && <UpcomingBookings bookings={data.upcoming} onOpenBooking={sheet.show} />}
      {data && <RecentActivity activity={data.activity} />}

      {sheet.element}
    </main>
  );
}
