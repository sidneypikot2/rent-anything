"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { DateRangeField } from "@/components/ui/date-range-field";
import { useSession } from "@/lib/auth/session";
import { todayIso } from "./format";
import { headcount, PARTY_RULES, type Room } from "./party";
import { RoomsAndGuests } from "./rooms-and-guests";
import { datesParty, type TripDates } from "./trip-dates";

// The trip dates and party for this destination — adults, children, infants and pets (RAA-184) —
// kept in the URL so every add and quote uses them. Like "Add to trip", it is for guests: a partner
// or admin has nothing to apply the dates to (RAA-85). The area page has none: its search bar
// sets them, and its rail only sums them up (TripCard).
export function TripDatesBar({ dates }: { dates: TripDates }) {
  const session = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [range, setRange] = useState({ from: dates.from ?? "", to: dates.to ?? "" });
  const [party, setParty] = useState(() => {
    const { pets, ...people } = datesParty(dates);
    return { people: people as Room, pets };
  });
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
    const guests = headcount(party.people);
    if (guests > 1) params.set("guests", String(guests));
    if (party.people.children > 0) params.set("children", String(party.people.children));
    if (party.people.infants > 0) params.set("infants", String(party.people.infants));
    if (party.pets > 0) params.set("pets", String(party.pets));
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
      <RoomsAndGuests
        label="Guests"
        rooms={[party.people]}
        pets={party.pets}
        rules={PARTY_RULES}
        petsHint="Travelling with you"
        onChange={([people], pets) => setParty({ people, pets })}
        data-testid="trip-dates-party"
      />
      <Button type="submit" variant="soft" size="touch">
        Set dates
      </Button>
    </form>
  );
}
