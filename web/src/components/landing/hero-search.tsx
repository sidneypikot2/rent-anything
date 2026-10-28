"use client";

import { useEffect, useState } from "react";
import { SearchBox } from "@/components/discovery/search-box";
import { readTripDates, withDates } from "@/components/trips/trip-dates";
import { Button, ButtonLink } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { formatDateRange } from "@/lib/dates";
import { useHeroTrip, useStartTrip } from "./hero-trip";
import { LAUNCH_AREA } from "./launch-area";
import { SearchPill } from "./search-bar";
import { guestsLabel } from "@/components/trips/format";

const PHONE = "(max-width: 749px)";

// The home hero's search (RAA-130): from sm the route card in the hero; on a phone the same pill
// as every other page's header search, which opens the hero's search in a sheet, so the title, the
// way in and the kinds of things to book share the first screen. One search is mounted at a
// time, as each reports to the rest of the hero (HeroTrip); the sheet's stays mounted while it
// is closed, so it keeps what was picked. Until the screen is known, CSS shows the right one.
// Under the phone's pill is the search's own button, full width, so the first screen's main
// action is starting a trip, and the pill is only a summary to tap: Start your trip goes straight
// to what Where holds; Search, once Where names something that can't start one (or for a partner
// or an admin, who have no cart), goes where the sheet's own button would (where it matched); with Where
// emptied there is nothing to search, and it opens the sheet.
// With no dates yet, Start your trip first opens the sheet on When (its calendar offers Not sure
// yet), so a trip starts with its days and guests, as the hero's row does from `search` up. A
// guest with trips is asked which one instead, and the button says continue.
export function HeroSearch() {
  const [phone, setPhone] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [request, setRequest] = useState<{ panel: "when"; n: number }>();
  const { where, carry, trip, search } = useHeroTrip();
  const startTrip = useStartTrip();

  useEffect(() => {
    const query = window.matchMedia(PHONE);
    const update = () => setPhone(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  const dates = readTripDates(Object.fromEntries(new URLSearchParams(carry)));
  const askDates = () => {
    setRequest((last) => ({ panel: "when", n: (last?.n ?? 0) + 1 }));
    setOpen(true);
  };

  return (
    <>
      {phone !== true && (
        <div className="max-search:hidden">
          <SearchBox hero />
        </div>
      )}
      {/* A summary to tap, without the bar's magnifier: the button under it is the one action. An
          empty Where starts on the launch area, so the pill names it. */}
      <SearchPill
        summary
        where={where || LAUNCH_AREA.name}
        dateLabel={formatDateRange(dates.from, dates.to)}
        guestsLabel={guestsLabel(dates.guests, dates.pets)}
        onClick={() => setOpen(true)}
      />
      <div className="mt-3 flex flex-col search:hidden">
        {/* A guest with trips picks one first (its dates come with it); anyone else is asked
            for the dates before a new trip starts. */}
        {trip && startTrip.asks ? (
          <Button type="button" arrow onClick={() => startTrip.start(trip, carry)} data-testid="hero-start">
            {startTrip.label}
          </Button>
        ) : trip && !dates.from ? (
          <Button type="button" arrow onClick={askDates} data-testid="hero-start">
            {startTrip.label}
          </Button>
        ) : trip ? (
          <ButtonLink arrow href={withDates(trip, carry)} data-testid="hero-start">
            {startTrip.label}
          </ButtonLink>
        ) : where ? (
          <ButtonLink arrow href={withDates(search, carry)} data-testid="hero-start">
            Search
          </ButtonLink>
        ) : (
          <Button type="button" arrow onClick={() => setOpen(true)} data-testid="hero-start">
            Search
          </Button>
        )}
      </div>
      {phone && (
        <Dialog open={open} placement="sheet" title="Plan your trip" onClose={() => setOpen(false)}>
          <SearchBox hero sheet request={request} onDone={() => setOpen(false)} />
        </Dialog>
      )}
    </>
  );
}
