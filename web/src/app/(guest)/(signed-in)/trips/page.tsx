import type { Metadata } from "next";
import { PageBanner } from "@/components/landing/page-banner";
import { PageSheet } from "@/components/landing/page-sheet";
import { TripsView } from "@/components/trips/trips-view";
import { ButtonLink } from "@/components/ui/button";
import { DisplayTitle } from "@/components/ui/typography";

export const metadata: Metadata = {
  title: "Trips",
};

// The guest's booked trips, happening now, upcoming and past, laid out like the cart (RAA-68,
// RAA-140). `?trip=<id>` shows that trip.
export default async function Trips(props: PageProps<"/trips">) {
  const trip = Number((await props.searchParams).trip);
  return (
    <main data-testid="trips" className="flex flex-1 flex-col">
      <PageBanner title={<DisplayTitle>Trips</DisplayTitle>} search={false}>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/cart" variant="soft" size="sm">
            Cart
          </ButtonLink>
          <ButtonLink href="/trips/bookings" variant="soft" size="sm" data-testid="trips-bookings-link">
            All bookings
          </ButtonLink>
        </div>
      </PageBanner>
      <PageSheet tone="paper">
        <div className="mx-auto flex w-full max-w-page flex-col gap-6 px-gutter py-page-pad">
          <TripsView expandTripId={Number.isInteger(trip) && trip > 0 ? trip : undefined} />
        </div>
      </PageSheet>
    </main>
  );
}
