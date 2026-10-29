"use client";

import { usePathname, useRouter } from "next/navigation";
import { EditTripSheet } from "./edit-trip-sheet";
import { tripOwnQuery } from "./trip-dates";
import type { Trip } from "./use-trips";

// The page's dates and guests in the URL.
const DATE_KEYS = ["from", "to", "guests", "children", "infants", "pets", "start"];

// The cart's Edit trip sheet on a place's page, opened on its dates: a trip started with no
// dates (the first add) can get them here, and its guests, without going to the cart. Once
// saved, the page takes the trip's new dates and guests, so prices, the header's search and the
// add sheet follow it (the same as Switch trip).
export function TripDatesSheet({ trip, onClose }: { trip: Trip; onClose: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  function saved(updated: Trip) {
    onClose();
    const params = new URLSearchParams(window.location.search);
    DATE_KEYS.forEach((key) => params.delete(key));
    new URLSearchParams(tripOwnQuery(updated)).forEach((value, key) => params.set(key, value));
    const query = params.toString();
    router.replace(`${pathname}${query ? `?${query}` : ""}${window.location.hash}`, { scroll: false });
  }
  return <EditTripSheet trip={trip} focus="dates" onClose={onClose} onSaved={saved} />;
}
