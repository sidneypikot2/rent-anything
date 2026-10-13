import type { Metadata } from "next";
import { PageBanner } from "@/components/landing/page-banner";
import { TRIPS_PHOTO } from "@/components/landing/sample-photos";
import { TripsView } from "@/components/trips/trips-view";
import { DisplayTitle } from "@/components/ui/typography";

export const metadata: Metadata = {
  title: "Trips",
};

// Every trip the guest has, upcoming and past (RAA-68).
export default function Trips() {
  return (
    <main data-testid="trips" className="flex flex-1 flex-col">
      <PageBanner photo={TRIPS_PHOTO} title={<DisplayTitle>Trips</DisplayTitle>} />
      <div className="mx-auto flex w-full max-w-narrow flex-col gap-6 px-gutter py-page-pad">
        <TripsView />
      </div>
    </main>
  );
}
