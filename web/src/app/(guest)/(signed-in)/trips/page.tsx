import type { Metadata } from "next";
import { PageBanner } from "@/components/landing/page-banner";
import { PageSheet } from "@/components/landing/page-sheet";
import { TripsView } from "@/components/trips/trips-view";
import { DisplayTitle } from "@/components/ui/typography";

export const metadata: Metadata = {
  title: "Trips",
};

// Every trip the guest has, upcoming and past (RAA-68).
export default function Trips() {
  return (
    <main data-testid="trips" className="flex flex-1 flex-col">
      <PageBanner title={<DisplayTitle>Trips</DisplayTitle>} />
      <PageSheet>
        <div className="mx-auto flex w-full max-w-narrow flex-col gap-6 px-gutter py-page-pad">
          <TripsView />
        </div>
      </PageSheet>
    </main>
  );
}
