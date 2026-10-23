"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { DateRangeField } from "@/components/ui/date-range-field";
import { StepperField } from "@/components/ui/stepper-field";
import { useSession } from "@/lib/auth/session";
import { todayIso } from "./format";
import type { TripDates } from "./trip-dates";

// The trip dates and guests for this destination, kept in the URL so every add (and,
// later, availability and quotes) uses them. Like "Add to trip", it is for guests: a partner
// or admin has nothing to apply the dates to (RAA-85). The area page has none: its search bar
// sets them, and its rail only sums them up (TripCard).
export function TripDatesBar({ dates }: { dates: TripDates }) {
  const session = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [range, setRange] = useState({ from: dates.from ?? "", to: dates.to ?? "" });
  const [guests, setGuests] = useState(dates.guests);
  const [error, setError] = useState<string>();

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const { from, to } = range;
    if (Boolean(from) !== Boolean(to)) return setError("Pick both dates, or neither");
    setError(undefined);
    const params = new URLSearchParams();
    if (from) {
      params.set("from", from);
      params.set("to", to);
    }
    if (guests > 1) params.set("guests", String(guests));
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  if (session && session.user.role !== "guest") return null;

  return (
    <form
      onSubmit={apply}
      data-testid="trip-dates"
      className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]"
    >
      <DateRangeField
        label="Dates"
        min={todayIso()}
        from={range.from}
        to={range.to}
        onChange={setRange}
        clearable
        error={error}
        className="col-span-2 self-start sm:col-span-1"
        data-testid="trip-dates-range"
      />
      <StepperField label="Guests" min={1} max={50} value={guests} onChange={setGuests} />
      <Button type="submit" variant="soft" size="touch">
        Set dates
      </Button>
    </form>
  );
}
