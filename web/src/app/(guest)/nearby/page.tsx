import type { Metadata } from "next";
import { NearbyMap } from "@/components/discovery/nearby-map";
import { DisplayTitle } from "@/components/ui/typography";

export const metadata: Metadata = { title: "Nearby (test)" };

// A testing page (RAA-53): pin a spot, confirm it, and see the listings and destinations
// within a chosen distance of it, from the explore endpoint (RAA-57).
export default function NearbyPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-10">
      <div className="flex flex-col gap-2">
        <DisplayTitle>What&apos;s nearby</DisplayTitle>
        <p className="text-muted">Drop a pin, confirm it, then set how far you&apos;ll go.</p>
      </div>
      <NearbyMap />
    </main>
  );
}
