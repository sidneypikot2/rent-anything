import type { Metadata } from "next";
import { TripsView } from "@/components/trips/trips-view";

export const metadata: Metadata = {
  title: "Trips",
};

// Every trip the guest has, upcoming and past (RAA-68).
export default function Trips() {
  return (
    <main data-testid="trips" className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10">
      <TripsView />
    </main>
  );
}
