import type { Metadata } from "next";
import { PageBanner } from "@/components/landing/page-banner";
import { PageSheet } from "@/components/landing/page-sheet";
import { TripsView } from "@/components/trips/trips-view";
import { ButtonLink } from "@/components/ui/button";
import { DisplayTitle } from "@/components/ui/typography";

export const metadata: Metadata = {
  title: "Booked trips",
};

// The guest's booked trips, happening now, upcoming and past, laid out like the cart (RAA-68,
// RAA-140). `?trip=<id>` shows that trip.
export default async function Trips(props: PageProps<"/trips">) {
  const trip = Number((await props.searchParams).trip);
  return (
    <main data-testid="trips" className="flex flex-1 flex-col">
      <PageBanner title={<DisplayTitle size="compact">Booked trips</DisplayTitle>} search={false} compact>
        <ButtonLink href="/cart" variant="soft" size="sm" className="shrink-0 self-start">
          Trips you&apos;re planning
        </ButtonLink>
      </PageBanner>
      <PageSheet tone="paper">
        <div className="mx-auto flex w-full max-w-page flex-col gap-6 px-gutter pb-page-pad pt-4 max-sm:px-0 sm:pt-6">
          <TripsView expandTripId={Number.isInteger(trip) && trip > 0 ? trip : undefined} />
        </div>
      </PageSheet>
    </main>
  );
}
