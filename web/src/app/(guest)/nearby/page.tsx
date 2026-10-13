import type { Metadata } from "next";
import { NearbyMap } from "@/components/discovery/nearby-map";
import { DisplayTitle } from "@/components/ui/typography";
import { PageSheet } from "@/components/landing/page-sheet";

export const metadata: Metadata = { title: "Nearby (test)" };

// A testing page (RAA-53): pin a spot, confirm it, and see the listings and destinations
// within a chosen distance of it, from the explore endpoint (RAA-57).
export default function NearbyPage() {
  return (
    <main className="flex flex-1 flex-col pt-3 sm:pt-6">
      <PageSheet>
        <div className="mx-auto flex w-full max-w-page flex-1 flex-col gap-6 px-gutter py-page-pad">
          <div className="flex flex-col gap-2">
            <DisplayTitle>What&apos;s nearby</DisplayTitle>
            <p className="text-muted">Drop a pin, confirm it, then set how far you&apos;ll go.</p>
          </div>
          <NearbyMap />
        </div>
      </PageSheet>
    </main>
  );
}
