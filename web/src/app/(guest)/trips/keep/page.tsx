import type { Metadata } from "next";
import { KeepTrips } from "@/components/guest/keep-trips";
import { PageSheet } from "@/components/landing/page-sheet";

export const metadata: Metadata = {
  title: "Keep your trips",
  robots: { index: false, follow: false },
};

// Where the trip-link and reminder emails lead (RAA-177): a guest without an account sets a
// password, so their trips aren't deleted 60 days after they end.
export default function KeepTripsPage() {
  return (
    <main className="flex flex-1 flex-col pt-3 sm:pt-6">
      <PageSheet>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-gutter py-page-pad">
          <KeepTrips />
        </div>
      </PageSheet>
    </main>
  );
}
