"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { useSession } from "@/lib/auth/session";
import { todayIso } from "./format";
import type { TripDates } from "./trip-dates";

// The trip dates and guests for this destination, kept in the URL so every add (and,
// later, availability and quotes) uses them. Like "Add to trip", it is for guests: a partner
// or admin has nothing to apply the dates to (RAA-85).
export function TripDatesBar({ dates }: { dates: TripDates }) {
  const session = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [from, setFrom] = useState(dates.from ?? "");
  const [to, setTo] = useState(dates.to ?? "");
  const [guests, setGuests] = useState(String(dates.guests));
  const [error, setError] = useState<string>();
  const [guestsError, setGuestsError] = useState<string>();

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (Boolean(from) !== Boolean(to)) return setError("Pick both dates, or neither");
    if (from && to < from) return setError("The end can't be before the start");
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
      className="grid grid-cols-2 items-start gap-3 sm:grid-cols-[1fr_1fr_7rem_auto]"
    >
      <Field
        label="From"
        type="date"
        min={todayIso()}
        value={from}
        onChange={(event) => setFrom(event.target.value)}
        error={error}
      />
      <Field
        label="To"
        type="date"
        min={from || todayIso()}
        value={to}
        onChange={(event) => setTo(event.target.value)}
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
