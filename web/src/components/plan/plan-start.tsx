"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { chooseTrip } from "@/components/trips/chosen-trip";
import type { TripDates } from "@/components/trips/trip-dates";
import { currentTrips, useCreateTrip, useTrips, useUpdateTrip } from "@/components/trips/use-trips";
import { Button } from "@/components/ui/button";
import { DateRangeField } from "@/components/ui/date-range-field";
import { SelectField } from "@/components/ui/select-field";
import { StepperField } from "@/components/ui/stepper-field";
import { useToast } from "@/components/ui/toast";
import { startGuestSession } from "@/lib/auth/actions";
import { useSession } from "@/lib/auth/session";
import { formatDateRange, localTodayIso } from "@/lib/dates";
import type { LatLng } from "@/lib/geo";
import { PlanFoot, PlanHeading } from "./plan-frame";

export type PlanPlace = { slug: string; name: string; center: LatLng };

// Step 1 (the team's A2): where, when and who, asked once for the whole trip. Where the guest is
// staying is asked in the checklist's first step (`PlanStayChoice`). Next makes the trip (a guest with no account first,
// when signed out, as a first add does) or, back here from the checklist (`tripId`), changes it;
// the trip becomes the one this tab works on, and the checklist opens on its place.
export function PlanStart({
  places,
  initialWhere,
  dates,
  tripId,
}: {
  places: PlanPlace[];
  initialWhere: string;
  dates: TripDates;
  tripId?: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const session = useSession();
  const isGuest = session?.user.role === "guest";
  const trips = useTrips(isGuest);
  const existing = tripId ? currentTrips(trips.data).find((trip) => trip.id === tripId) : undefined;
  const create = useCreateTrip();
  const update = useUpdateTrip();
  const [where, setWhere] = useState(initialWhere);
  const [range, setRange] = useState({ from: dates.from ?? "", to: dates.to ?? "" });
  const [adults, setAdults] = useState(Math.max(1, dates.guests - (dates.children ?? 0)));
  const [children, setChildren] = useState(dates.children ?? 0);
  const [working, setWorking] = useState(false);
  const [tried, setTried] = useState(false);

  // Back from the checklist: the trip's own answers, once it has loaded.
  const [filledFrom, setFilledFrom] = useState<number | null>(null);
  if (existing && filledFrom !== existing.id) {
    setFilledFrom(existing.id);
    if (existing.starts_on && existing.ends_on) setRange({ from: existing.starts_on, to: existing.ends_on });
    setAdults(Math.max(1, existing.guests - existing.children - existing.infants));
    setChildren(existing.children);
  }

  const place = places.find((each) => each.slug === where) ?? places[0];
  const datesSet = Boolean(range.from && range.to);
  const ready = Boolean(place) && datesSet;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setTried(true);
    if (!ready || !place || working || session === undefined) return;
    if (session && !isGuest) {
      toast.show("Trips are for guests. Sign in with a guest account to plan one.", { tone: "danger" });
      return;
    }
    setWorking(true);
    try {
      if (!session) {
        const result = await startGuestSession();
        if (!result.ok) {
          toast.show(result.error, { tone: "danger" });
          return;
        }
      }
      const guests = adults + children;
      const trip = existing
        ? await update.mutateAsync({
            id: existing.id,
            changes: { name: existing.name, guests, children, starts_on: range.from, ends_on: range.to },
          })
        : await create.mutateAsync({
            name: `${place.name} · ${formatDateRange(range.from, range.to)}`,
            guests,
            children,
            starts_on: range.from,
            ends_on: range.to,
          });
      chooseTrip(trip.id);
      router.push(`/plan/${place.slug}?trip=${trip.id}`);
    } catch {
      // The mutation's toast says what went wrong.
    } finally {
      setWorking(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-1 flex-col" noValidate>
      <div className="flex flex-col gap-5 pb-8">
        <PlanHeading title="Where, when and who?" />
        <SelectField
          label="Where"
          value={where}
          onChange={(event) => setWhere(event.currentTarget.value)}
          options={places.map((each) => ({ value: each.slug, label: each.name }))}
          data-testid="plan-where"
        />
        <DateRangeField
          label="When"
          from={range.from}
          to={range.to}
          min={localTodayIso()}
          onChange={setRange}
          placeholder="Add your dates"
          error={tried && !datesSet ? "Pick the day you arrive and the day you leave" : undefined}
          data-testid="plan-dates"
        />
        <fieldset className="flex flex-col gap-1 rounded-control border border-line px-4 py-2">
          <legend className="px-1 text-sm font-semibold">Who&apos;s coming</legend>
          <StepperField
            label="Adults"
            value={adults}
            onChange={setAdults}
            min={1}
            max={50 - children}
            data-testid="plan-adults"
          />
          <StepperField
            label="Children"
            hint="Under 13"
            value={children}
            onChange={setChildren}
            min={0}
            max={Math.min(49, 50 - adults)}
          />
        </fieldset>
      </div>
      {/* The dates field says what's missing itself. */}
      <PlanFoot>
        <Button type="submit" size="md" glyph="arrow" loading={working} data-testid="plan-next">
          {working ? "Saving…" : "Next"}
        </Button>
      </PlanFoot>
    </form>
  );
}
