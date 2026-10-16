"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { DateRangeField } from "@/components/ui/date-range-field";
import { Field } from "@/components/ui/field";
import { useSession } from "@/lib/auth/session";
import { todayIso } from "./format";
import type { TripDates } from "./trip-dates";

// The trip dates and guests for this destination, kept in the URL so every add (and,
// later, availability and quotes) uses them. Like "Add to trip", it is for guests: a partner
// or admin has nothing to apply the dates to (RAA-85). `rail`: it also sits in a narrow column
// from lg (the area page's filter rail, RAA-125), so there the dates take a row of their own.
export function TripDatesBar({ dates, rail = false }: { dates: TripDates; rail?: boolean }) {
  const session = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [range, setRange] = useState({ from: dates.from ?? "", to: dates.to ?? "" });
  const [guests, setGuests] = useState(String(dates.guests));
  const [error, setError] = useState<string>();
  const [guestsError, setGuestsError] = useState<string>();

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const { from, to } = range;
    if (Boolean(from) !== Boolean(to)) return setError("Pick both dates, or neither");
    const guestsNumber = Number(guests);
    if (!Number.isInteger(guestsNumber) || guestsNumber < 1 || guestsNumber > 50) return setGuestsError("1 to 50");
    setError(undefined);
    setGuestsError(undefined);
    const params = new URLSearchParams();
    if (from) {
      params.set("from", from);
      params.set("to", to);
    }
    if (Number(guests) > 1) params.set("guests", guests);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  if (session && session.user.role !== "guest") return null;

  return (
    <form
      onSubmit={apply}
      data-testid="trip-dates"
      className={cn(
        "grid grid-cols-2 items-start gap-3 sm:grid-cols-[1fr_7rem_auto]",
        rail && "lg:grid-cols-[minmax(0,1fr)_auto]",
      )}
    >
      <DateRangeField
        label="Dates"
        min={todayIso()}
        from={range.from}
        to={range.to}
        onChange={setRange}
        clearable
        error={error}
        className={cn("col-span-2 sm:col-span-1", rail && "lg:col-span-2")}
        data-testid="trip-dates-range"
      />
      <Field
        label="Guests"
        type="number"
        min={1}
        max={50}
        value={guests}
        onChange={(event) => setGuests(event.target.value)}
        error={guestsError}
      />
      <Button type="submit" variant="soft" size="touch" className="self-end">
        Set dates
      </Button>
    </form>
  );
}
