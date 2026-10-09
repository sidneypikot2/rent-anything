import { formatDay } from "./format";
import type { Trip } from "./use-trips";

// The deletion notice (decisions 10, 12, 15): from the day after a trip ends, or after 60
// days without edits for an undated one, its unbooked items are deleted on `deletes_on`.
// Nothing can be booked yet, so that's every item. New dates, or any edit to an undated
// trip, take the notice away.
export function DeletionBanner({ trip, onChangeDates }: { trip: Trip; onChangeDates: () => void }) {
  if (!trip.deletes_on) return null;

  return (
    <div
      role="status"
      data-testid="trip-deletion-banner"
      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-xl border-[1.5px] border-warning bg-surface-2 px-3 py-2 text-sm"
    >
      <span>
        <span className="font-semibold">Nothing booked</span> · deletes on {formatDay(trip.deletes_on)}
      </span>
      <button type="button" onClick={onChangeDates} className="font-semibold text-link hover:underline">
        Change dates
      </button>
    </div>
  );
}
