"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Fragment, useCallback, useEffect, useState, type ComponentProps, type ReactNode } from "react";
import { useEditSearch } from "@/components/landing/current-place";
import { TripChoiceSheet } from "@/components/landing/trip-choice-sheet";
import { tripHref } from "@/components/landing/launch-area";
import { CHIP_ROW, PageBanner, STAT_CHIP, StatCount } from "@/components/landing/page-banner";
import { isApiPhoto, listingCover } from "@/components/landing/sample-photos";
import { BookingStatusBadge } from "@/components/bookings/booking-status";
import { ButtonLink } from "@/components/ui/button";
import { Pill, PillLink, pillClasses } from "@/components/ui/pill";
import { cn } from "@/components/ui/cn";
import { glassClasses } from "@/components/ui/glass";
import { ArrowGlyph, ListGlyph } from "@/components/discovery/tag-glyphs";
import { formatDateRange } from "@/lib/dates";
import { chooseTrip } from "./chosen-trip";
import { HereItemsSheet } from "./here-items-sheet";
import { guestsLabel, thingCount } from "./format";
import { tripOwnQuery } from "./trip-dates";
import { gapGroup, planGaps, stillMissing, type PlanGap, type Sight } from "./trip-missing";
import { TripNeeds } from "./trip-needs";
import { openPlan } from "./plan-open";
import { TripPlan } from "./trip-plan-panel";
import { bookable } from "./trip-details";
import { tripPlaces, type TripPlace } from "./trip-places";
import { useTripHere } from "./use-trip-here";
import type { Trip, TripItem } from "./use-trips";

// An area page's banner: the place's photo, name and counts (`banner`, `statChips` and
// `placeLinks`, built on the server), with the trip's one line at its foot. The guest picks the
// place, books what they need from What to book, and checks out from the cart: the banner never
// becomes a trip's own page. With no trip here yet (signed out, none yet, or still loading) the
// line says the trip starts with the first add (no account needed, RAA-177); once the guest has a trip
// with something here, or chose one to work on, it is TripNotice, whose Checkout opens it in the
// cart ("View trip" once all of it is booked). A guest with trips switches which one they work on
// here (Switch trip, TripChoiceSheet): the page takes that trip's dates and guests, and the add
// sheet preselects it. A trip shown on a page opened with no dates or guests (a bare link, the
// home's place cards) puts its own in the URL the same way, so the header's search, prices and
// the add sheet all start from the trip rather than "Add dates · Just me".
// A trip with something here leads the banner instead, under a small line naming the place.
// One banner at every width: on a phone or a short window (COMPACT) the trip's line is one slim
// row, so the first screen still reaches What to book. The search is the header's (HeaderSearch).
// `starting`: arrived from the home's "Start your trip" (RAA-80), read once and dropped.
export function AreaHero({
  banner,
  statChips,
  placeLinks,
  areaName,
  places,
  offered,
  sights = [],
  starting = false,
}: {
  banner: { photo: ComponentProps<typeof PageBanner>["photo"]; eyebrow: string; title: ReactNode };
  // The place's counts, as chip list items ("20 to book" first), and the places inside it with things to book.
  statChips: ReactNode[];
  placeLinks: { href: string; name: string; count: number }[];
  areaName: string;
  places: string[];
  // The groups the place has listings in, so the trip's "still missing" asks only for those.
  offered: string[];
  // The places to see here and the listings that go to each, for the plan's "Not on any of your tours yet".
  sights?: Sight[];
  starting?: boolean;
}) {
  const edit = useEditSearch();
  const { session, isGuest, trips, current, chosen, trip } = useTripHere(places);
  const router = useRouter();
  const pathname = usePathname();
  const [switching, setSwitching] = useState(false);
  // Work on another trip, or a new one. A trip's own dates and guests replace the page's, so
  // prices and what's free are its; the rest of the query (?show=) stays.
  function pick(choice: Trip | "new") {
    setSwitching(false);
    chooseTrip(choice === "new" ? "new" : choice.id);
    if (choice === "new") return;
    const params = new URLSearchParams(window.location.search);
    ["from", "to", "guests", "start"].forEach((key) => params.delete(key));
    new URLSearchParams(tripOwnQuery(choice)).forEach((value, key) => params.set(key, value));
    const query = params.toString();
    router.replace(`${pathname}${query ? `?${query}` : ""}`, { scroll: false });
  }
  const switchTrip = () => setSwitching(true);
  const sheet = switching && (
    <TripChoiceSheet
      trips={current}
      areaName={areaName}
      places={places}
      selected={trip?.id ?? (chosen === "new" ? "new" : undefined)}
      onPick={pick}
      onClose={() => setSwitching(false)}
    />
  );

  // The shown trip's own dates and guests, into a URL that has none (see above). Dates the guest
  // set in the header's search stay theirs.
  const ownQuery = trip && !(isGuest && trips.isPending) ? tripOwnQuery(trip) : "";
  useEffect(() => {
    if (!ownQuery) return;
    const params = new URLSearchParams(window.location.search);
    if (["from", "to", "guests"].some((key) => params.has(key))) return;
    new URLSearchParams(ownQuery).forEach((value, key) => params.set(key, value));
    router.replace(`${pathname}?${params}${window.location.hash}`, { scroll: false });
  }, [ownQuery, pathname, router]);

  const [fresh] = useState(starting);
  useEffect(() => {
    if (!starting) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("start");
    window.history.replaceState(window.history.state, "", url);
  }, [starting]);

  const chips = (
    <ul aria-label={`In ${areaName}`} className={CHIP_ROW}>
      {statChips}
      {/* The places inside this one with things to book, linked to their own pages (RAA-85). */}
      {placeLinks.map((link) => (
        <li key={link.href} className="shrink-0">
          <Link href={link.href} className={cn(STAT_CHIP, glassClasses(), "hover:bg-glass-hover")}>
            <StatCount count={link.count} /> in {link.name}
            <ArrowGlyph className="size-4 text-sky-pale" />
          </Link>
        </li>
      ))}
    </ul>
  );
  // A partner or admin browsing: the place alone.
  if (session && !isGuest)
    return (
      <PageBanner photo={banner.photo} eyebrow={banner.eyebrow} title={banner.title}>
        {chips}
      </PageBanner>
    );
  const loading = isGuest && trips.isPending;
  // Trips to choose from with none shown: a guest who has trips, none with something here (or
  // who chose a new one).
  const choosable = isGuest && !loading && !trip && current.length > 0;
  // The trip's guide (TripPlan), opened from the trip's row, What to book's first chip, or the wide card.
  const plan = !loading && trip && (
    <TripPlan trip={trip} places={places} offered={offered} sights={sights} placeName={areaName} />
  );
  const notice = (lead: boolean) =>
    trip && (
      <TripNotice
        trip={trip}
        places={places}
        placeName={areaName}
        offered={offered}
        lead={lead}
        onSwitch={current.length > 1 ? switchTrip : undefined}
        onAnotherPlace={edit ? () => edit("where", { trip: trip.id }) : undefined}
      />
    );
  // A trip with something here leads the banner: the guest has chosen the place, so its name
  // folds into one small line on top (still the page's h1) and the counts follow the trip.
  if (!loading && trip?.items.some((item) => places.includes(item.area.slug)))
    return (
      <PageBanner
        photo={banner.photo}
        title={
          <h1
            data-testid="area-title-small"
            // `card` glass, as PageBanner's eyebrow: the top of the photo is its lightest part.
            // One line at any width: the name keeps whole and the region gives way (a 330px phone).
            className={cn(
              glassClasses("card"),
              "flex max-w-full min-w-0 items-center gap-2 self-start rounded-full px-3.5 py-1.5 text-sm font-semibold",
            )}
          >
            <span aria-hidden className="size-2 shrink-0 rounded-full bg-mint" />
            <span className="shrink-0 whitespace-nowrap">{areaName}</span>
            <span className="min-w-0 truncate font-normal text-sky-mist">· {banner.eyebrow}</span>
          </h1>
        }
      >
        {notice(true)}
        {chips}
        {sheet}
        {plan}
      </PageBanner>
    );
  return (
    <PageBanner photo={banner.photo} eyebrow={banner.eyebrow} title={banner.title}>
      {chips}
      {!loading && trip ? (
        notice(false)
      ) : (
        <div
          aria-label="Your trip"
          data-testid="trip-lead"
          className={cn(glassClasses("forest"), "flex flex-col gap-3 rounded-card px-4 py-3 sm:px-5", WIDE_ONLY)}
        >
          {loading ? (
            <div role="status" aria-busy className="flex flex-col gap-2 py-1">
              <span className="sr-only">Loading your trip…</span>
              <span className="h-5 w-64 max-w-full rounded-full bg-glass-fill motion-safe:animate-pulse" />
              <span className="h-4 w-44 rounded-full bg-glass-fill motion-safe:animate-pulse" />
            </div>
          ) : (
            <div className="flex min-w-0 flex-wrap items-end justify-between gap-x-6 gap-y-2">
              <div className="min-w-0">
                <h2 className="font-display text-lg leading-tight font-extrabold tracking-tight text-balance">
                  {choosable && chosen !== "new"
                    ? "Adding to one of your trips?"
                    : choosable
                      ? "A new trip starts with your first add"
                      : fresh
                        ? "Your trip starts here"
                        : "Your trip starts with your first add"}
                </h2>
                <p className="mt-0.5 text-sm text-pretty text-sky-mist">
                  {choosable && chosen !== "new"
                    ? `Choose the trip to work on, or your first add here asks which. You have ${current.length === 1 ? "one trip" : `${current.length} trips`}.`
                    : isGuest
                      ? "Add what you need, then book it all from your trip."
                      : "Add what you need, then book it all from your trip. Saving is free, no account needed."}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {choosable && (
                  <button
                    type="button"
                    onClick={switchTrip}
                    data-testid="trip-choose"
                    className="flex min-h-11 shrink-0 items-center gap-2 rounded-button px-4 text-sm font-semibold text-sky-pale transition-colors duration-300 ease-calm hover:bg-glass-hover hover:text-white"
                  >
                    {chosen === "new" ? "Choose a trip instead" : "Choose a trip"}
                  </button>
                )}
                <ButtonLink href="#listings" variant="frosted" size="touch" data-testid="trip-lead-next" className="shrink-0">
                  See what to book
                  <ArrowGlyph className="size-4 rotate-90 text-sky-pale" />
                </ButtonLink>
              </div>
            </div>
          )}
        </div>
      )}
      {/* Compact, no trip yet (signed out, none, loading): one slim row saying how the trip starts,
          down to What to book, so a phone's first screen has the trip and its next step. */}
      {!choosable && !(!loading && trip) && (
        <a
          href="#listings"
          data-testid="trip-lead-compact"
          className={cn(
            glassClasses("forest"),
            COMPACT_ONLY,
            "min-h-11 items-center justify-between gap-3 rounded-card py-1.5 pr-4 pl-3 text-left text-sm",
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            <span aria-hidden className="size-2 shrink-0 rounded-full bg-sky-pale" />
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="truncate font-semibold">Start your trip here</span>
              <span className="truncate text-small text-sky-mist">Saving it is free</span>
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-1.5 font-semibold">
            What to book
            <span aria-hidden className="text-sky-pale">
              ↓
            </span>
          </span>
        </a>
      )}
      {/* Compact, with trips but none shown: one slim row to choose one, as the lead does. */}
      {choosable && (
        <button
          type="button"
          onClick={switchTrip}
          data-testid="trip-choose-compact"
          className={cn(
            glassClasses("forest"),
            COMPACT_ONLY,
            "min-h-11 items-center justify-between gap-3 rounded-card py-1 pr-4 pl-3 text-left text-sm",
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            <span aria-hidden className="size-2 shrink-0 rounded-full bg-sky-pale" />
            <span className="truncate">
              <span className="font-semibold">{chosen === "new" ? "New trip" : "Your trips"}</span> ·{" "}
              {chosen === "new" ? "starts with your first add" : "choose one to add to"}
            </span>
          </span>
          <span className="shrink-0 font-semibold">{chosen === "new" ? "Switch" : "Choose"}</span>
        </button>
      )}
      {sheet}
      {plan}
    </PageBanner>
  );
}

// Which layout a piece belongs to. Compact is a phone (under the search breakpoint, where the
// search opens in a sheet) or a short window (`fold`); the rest is wide. CSS picks, so the server's
// render and the first paint already match the screen.
const WIDE_ONLY = "max-search:hidden fold:hidden";
const COMPACT_ONLY = "hidden max-search:flex fold:flex";

// The guest's trip with something in this place: its name, dates, what it has here, and View
// trip, which opens it in the cart (where it is booked). Under them, what it still lacks
// (missingHere: nights without a stay, no transfer here), each linking to its section of What to
// book: a hint, never a step to finish. An auto-named trip ("Bantayan Island ·
// Oct 25–28") says its dates once. Compact, one slim row, so the first screen still reaches the
// search. `onSwitch`: Switch trip, when the guest has another trip.
// The trip's places (tripPlaces) as chips, each a link to that place's page on the trip's own
// dates, so a trip in Bantayan and Cebu City hops between them in one tap rather than a search
// each way; "+ Another place" opens the search on Where (`onAnotherPlace`). Compact, they show
// in a sideways row under the slim one, "+ Another place" last, so a phone has a way to add a
// place from the trip too, not only the header's search. This place's
// chip, while the trip has something here, opens HereItemsSheet: change a date or remove an add
// without going to the cart (shown at every width then, as it is the only way in on a phone).
// A trip only in this place shows no chip for it: its rows (HereItemRows) name what it has here
// and open the sheet, and a phone's chip names them rather than the banner's name again.
function TripNotice({
  trip,
  places,
  placeName,
  offered,
  lead,
  onSwitch,
  onAnotherPlace,
}: {
  trip: Trip;
  places: string[];
  placeName: string;
  offered: string[];
  // At the top of the banner, in place of the place's title: the trip's name is the big line.
  lead: boolean;
  onSwitch?: () => void;
  onAnotherPlace?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const closeEditing = useCallback(() => setEditing(false), []);
  const tripHere = tripPlaces(trip);
  const dated = tripOwnQuery(trip);
  // The phone row's count: the plan button's (stillMissing), so the two never disagree.
  const toSort = stillMissing(planGaps(trip, places, offered, []));
  const hereItems = trip.items.filter((item) => places.includes(item.area.slug));
  const items = hereItems.length;
  // What it has here, for a phone's chip: the one thing by name, or how many ("2 things here"),
  // so it matches the cart's count rather than cutting a second name off.
  const hereNames = items === 1 ? hereItems[0].listing.title : items > 1 ? `${thingCount(items)} here` : undefined;
  // A trip only in this place: its chip would repeat the banner's name, so the rows of what it
  // has here open the edit sheet instead and the chips start with "+ Another place".
  const onlyHere = tripHere.every((place) => places.includes(place.slug));
  const editHere = items > 0 ? () => setEditing(true) : undefined;
  // The trip's whole count, then this place's share when other places hold some ("2 things · 1
  // here"): "1 thing here" alone read as the whole trip. A chosen trip can have nothing here yet.
  const total = trip.items.length;
  const hereOnly = items > 0 ? `${thingCount(items)} here` : "nothing here yet";
  const here = total > items ? `${thingCount(total)} · ${items > 0 ? `${items} here` : "none here yet"}` : hereOnly;
  const range = formatDateRange(trip.starts_on, trip.ends_on);
  // An auto-named trip ("Bantayan Island · Nov 10–14") goes by its dates on the phone row: the
  // banner already names the place, and truncated on the end the dates were what got cut.
  const autoNamed = Boolean(range && trip.name.endsWith(` · ${range}`));
  const shortName = autoNamed && range ? range : trip.name;
  // The rows name what it has here, so the count stays only to share a trip out between places.
  // Leading the banner, the line says whose it is ("Your trip · 8 guests"), in place of an eyebrow.
  const parts = [
    lead && "Your trip",
    !(range && trip.name.includes(range)) && (range ?? "No dates yet"),
    guestsLabel(trip.guests),
    (!onlyHere || items === 0) && here,
  ].filter((part): part is string => Boolean(part));
  const href = tripHref(trip.id);
  // The link opens the trip in the cart, where it's booked: while anything in it can still be
  // booked that's the next step, so it says so; once all of it is booked it only shows the trip.
  const toBook = trip.items.some(bookable);
  const openLabel = toBook ? "Checkout" : "View trip";
  // The wide card names the first gap here (a stay or the transfer) as a link to its section and
  // counts the rest as "N more in your plan", which opens it, so the line and the plan always add
  // up to one number.
  // Gaps beyond the stay and transfer the checklist shows (an item to replace, an undated one).
  const others = toSort.filter((gap) => !["stay", "transfer"].includes(gapGroup(gap) ?? "")).length;
  // The phone row's second line, also the start of its accessible name (WCAG 2.5.3).
  const rowNote =
    toSort.length === 1 ? `Needs ${missingNoun(toSort[0])}` : toSort.length > 1 ? `${toSort.length} missing` : "Your plan";
  const linkStyle =
    "tap-target whitespace-nowrap text-sky-pale underline decoration-sky-pale/40 underline-offset-4 hover:text-white hover:decoration-white";
  return (
    <>
      <div
        aria-label="Your trip"
        data-testid="trip-notice"
        className={cn(
          glassClasses("forest"),
          // As wide as what it holds, so Checkout sits by the trip rather than across the banner.
          // Actions at the top, beside the trip's name, rather than floating mid-card.
          "flex w-fit max-w-full flex-wrap items-start justify-between gap-x-10 gap-y-2 rounded-card px-4 py-3 sm:px-5",
          WIDE_ONLY,
        )}
      >
        <div className="min-w-0">
          {lead ? (
            <h2 className="font-display text-2xl leading-tight font-extrabold tracking-tight text-balance sm:text-3xl">
              {trip.name}
            </h2>
          ) : (
            <h2 className="font-display text-lg leading-tight font-extrabold tracking-tight text-balance">
              Your trip: {trip.name}
            </h2>
          )}
          <p className="mt-0.5 text-sm text-pretty text-sky-mist">
            {parts.map((part, index) => (
              <Fragment key={part}>
                {index > 0 && " · "}
                <span className="whitespace-nowrap">{part}</span>
              </Fragment>
            ))}
          </p>
          {editHere && <HereItemRows items={hereItems} tripHref={href} onEdit={editHere} />}
          {(!onlyHere || onAnotherPlace) && (
            <PlaceChips
              tripPlaces={onlyHere ? [] : tripHere}
              places={places}
              dated={dated}
              onEditHere={editHere}
              onAnotherPlace={onAnotherPlace}
              data-testid="trip-places"
              className="mt-2 flex-wrap"
            />
          )}
          {/* What the trip can't do without here, ticking as the guest adds (a hint, never a step
              to finish), then anything else the plan lists, counted into it, so the two add up to
              the plan button's one number (stillMissing). */}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
            <TripNeeds trip={trip} places={places} offered={offered} />
            {others > 0 && (
              <button type="button" onClick={openPlan} aria-haspopup="dialog" data-testid="trip-missing-more" className={linkStyle}>
                {`${thingCount(others)} more in your plan`}
              </button>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <ButtonLink href={href} variant="frosted" size="touch" arrow data-testid="trip-notice-open" className="shrink-0">
            {openLabel}
          </ButtonLink>
          {/* The plan's way in while nothing is missing; otherwise the Still missing line opens it. */}
          {toSort.length === 0 && (
            <button
              type="button"
              onClick={openPlan}
              aria-haspopup="dialog"
              data-testid="trip-plan-open-wide"
              className="flex min-h-11 shrink-0 items-center gap-2 rounded-button px-3 text-sm font-semibold text-sky-pale transition-colors duration-300 ease-calm hover:bg-glass-hover hover:text-white"
            >
              <ListGlyph className="size-4" />
              Your plan
            </button>
          )}
          {onSwitch && (
            <button
              type="button"
              onClick={onSwitch}
              data-testid="trip-switch"
              className="min-h-8 px-2 text-small text-sky-mist underline-offset-4 hover:text-white hover:underline"
            >
              Switch trip
            </button>
          )}
        </div>
      </div>
      {/* Compact: the row is the way into the plan (TripPlan), what it lacks on its second line;
          Checkout (or View, beside Switch) is its own button on the right. */}
      <div className={cn(glassClasses("forest"), COMPACT_ONLY, "min-h-11 items-stretch rounded-card text-sm")}>
        <button
          type="button"
          onClick={openPlan}
          aria-haspopup="dialog"
          aria-label={`${shortName}, ${rowNote}${rowNote === "Your plan" ? "" : ": your plan"}`}
          data-testid="trip-plan-open"
          className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-l-card py-1 pr-2 pl-3 text-left transition-colors duration-300 ease-calm hover:bg-glass-hover"
        >
          <span
            aria-hidden
            className={cn("size-2 shrink-0 rounded-full", toSort.length > 0 ? "bg-sky-pale" : "bg-mint")}
          />
          {/* Its name, as a guest with trips may switch here, then what it lacks, when anything,
              rather than its count here: a phone has room for one. */}
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="truncate font-semibold">{shortName}</span>
            <span className="flex min-w-0 items-center gap-1 text-small text-sky-mist">
              <span className="truncate">{rowNote}</span>
              <ArrowGlyph className="size-3 shrink-0 text-sky-pale" />
            </span>
          </span>
        </button>
        <Link
          href={href}
          // Its name starts with the words it shows (WCAG 2.5.3): "View" beside Switch, else its label.
          aria-label={`${onSwitch ? "View trip" : openLabel}: ${trip.name}`}
          data-testid="trip-notice-compact"
          // The last control rounds its right end to the row's, so its hover fill keeps the row's shape.
          className={cn(
            "flex min-h-11 shrink-0 items-center gap-2 border-l border-glass-edge px-4 font-semibold transition-colors duration-300 ease-calm hover:bg-glass-hover",
            !onSwitch && "rounded-r-card",
          )}
        >
          {onSwitch ? "View" : openLabel}
          <ArrowGlyph className="size-4 text-sky-pale" />
        </Link>
        {onSwitch && (
          <button
            type="button"
            onClick={onSwitch}
            data-testid="trip-switch-compact"
            className="min-h-11 shrink-0 rounded-r-card border-l border-glass-edge px-4 font-semibold text-sky-pale transition-colors duration-300 ease-calm hover:bg-glass-hover hover:text-white"
          >
            Switch
          </button>
        )}
      </div>
      {(tripHere.length > 1 || items > 0 || onAnotherPlace) && (
        <PlaceChips
          tripPlaces={tripHere}
          places={places}
          dated={dated}
          onEditHere={editHere}
          hereLabel={onlyHere ? hereNames : undefined}
          onAnotherPlace={onAnotherPlace}
          data-testid="trip-places-compact"
          // Swiped on a phone: the right edge fades, as on the counts row (CHIP_ROW), so a cut chip
          // reads as more to come, and the end padding lets the last clear it.
          className={cn(COMPACT_ONLY, "-my-1 overflow-x-auto py-1 pr-8 [scrollbar-width:none] [mask-image:linear-gradient(to_right,black_calc(100%-2rem),transparent)]")}
        />
      )}
      {editing && <HereItemsSheet trip={trip} places={places} placeName={placeName} onClose={closeEditing} />}
    </>
  );
}

// What the trip has in this place, one row each: its photo, name, days and Edit, which opens
// HereItemsSheet (change a date, remove). A booked one says so and links to the trip, where its
// booking is managed. Two rows at most, then "+ N more here", so a long trip doesn't push What to
// book off the first screen; one in a window under 50rem tall (`tablet-fold`: a 1024×768 tablet
// on its side, where two left What to book's heading at the very foot).
const ROWS_SHOWN = 2;

function HereItemRows({ items, tripHref: href, onEdit }: { items: TripItem[]; tripHref: string; onEdit: () => void }) {
  const more = items.length - ROWS_SHOWN;
  const moreShort = items.length - 1;
  const link =
    "tap-target text-sm font-semibold text-sky-pale underline decoration-sky-pale/40 underline-offset-4 hover:text-white hover:decoration-white";
  return (
    <ul aria-label="In your trip here" data-testid="trip-here-items" className="mt-2.5 flex w-full max-w-md flex-col gap-1.5 sm:w-md">
      {items.slice(0, ROWS_SHOWN).map((item, index) => {
        const photo = listingCover(item.listing, index);
        const dates = formatDateRange(item.starts_on, item.ends_on);
        return (
          <li
            key={item.id}
            data-testid="trip-here-item"
            className={cn(
              "flex items-center gap-3 rounded-control border border-glass-edge bg-glass-fill py-1.5 pr-3 pl-1.5",
              index > 0 && "tablet-fold:hidden",
            )}
          >
            {/* The row's radius less its 6px inset. */}
            <Image
              src={photo.src}
              alt=""
              width={44}
              height={44}
              unoptimized={isApiPhoto(photo.src)}
              className="size-11 shrink-0 rounded-md object-cover"
            />
            <span className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="truncate font-semibold">{item.listing.title}</span>
              <span className="truncate text-small text-sky-mist">
                {dates ?? "No date yet"}
              </span>
            </span>
            {item.booking ? (
              <Link href={href} aria-label={`Manage booking: ${item.listing.title}`} className="flex shrink-0 items-center gap-2">
                <BookingStatusBadge status={item.booking.status} small />
              </Link>
            ) : (
              <button
                type="button"
                aria-haspopup="dialog"
                onClick={onEdit}
                data-testid="trip-here-edit"
                className="tap-target flex min-h-9 shrink-0 items-center rounded-chip border border-white/40 px-3.5 text-sm font-semibold text-white transition-colors duration-300 ease-calm hover:bg-glass-hover"
              >
                Edit<span className="sr-only"> {item.listing.title}</span>
              </button>
            )}
          </li>
        );
      })}
      {moreShort > 0 && (
        <li className={cn(more <= 0 && "hidden tablet-fold:block")}>
          <button type="button" aria-haspopup="dialog" onClick={onEdit} data-testid="trip-here-more" className={link}>
            <span className="tablet-fold:hidden">+ {more}</span>
            <span className="hidden tablet-fold:inline">+ {moreShort}</span> more here · See all
          </button>
        </li>
      )}
    </ul>
  );
}

// The trip's places as chips: the one this page is (or holds) marked, the others links to their
// pages with the trip's dates and guests, fetched ahead (`prefetch`: a trip has two or three, and
// the place page is dynamic, so by default only its loading state would be). `onEditHere`: the
// marked chip opens what the trip has here, to change or remove. `hereLabel`: that chip's words
// in place of the name and count (a phone's, when the trip is only here and the banner names it).
function PlaceChips({
  tripPlaces: list,
  places,
  dated,
  onEditHere,
  hereLabel,
  onAnotherPlace,
  className,
  "data-testid": testId,
}: {
  tripPlaces: TripPlace[];
  places: string[];
  dated: string;
  onEditHere?: () => void;
  hereLabel?: string;
  onAnotherPlace?: () => void;
  className?: string;
  "data-testid"?: string;
}) {
  return (
    <ul aria-label="Places in this trip" data-testid={testId} className={cn("flex items-center gap-2", className)}>
      {list.map((place) => {
        const here = places.includes(place.slug);
        const label =
          here && hereLabel ? (
            <span className="max-w-56 truncate">{hereLabel}</span>
          ) : (
            <>
              {place.name}
              <span className={here ? "text-muted" : "text-sky-pale/80"}>{place.count}</span>
            </>
          );
        return (
          <li key={place.slug} className="shrink-0">
            {here && onEditHere ? (
              <Pill
                tone="glass"
                on
                aria-haspopup="dialog"
                aria-current="page"
                onClick={onEditHere}
                data-testid="trip-place-edit"
              >
                <span aria-hidden className="size-1.5 rounded-full bg-primary" />
                {label}
                <span className="font-semibold text-link underline underline-offset-4">Edit</span>
              </Pill>
            ) : here ? (
              <span aria-current="page" className={pillClasses({ tone: "glass", on: true })}>
                <span aria-hidden className="size-1.5 rounded-full bg-primary" />
                {label}
              </span>
            ) : (
              <PillLink tone="glass" href={`/${place.slug}${dated}`} prefetch>
                {label}
                <ArrowGlyph className="size-4" />
              </PillLink>
            )}
          </li>
        );
      })}
      {onAnotherPlace && (
        <li className="shrink-0">
          {/* Dashed: a place the trip doesn't have yet. */}
          <Pill tone="glass" onClick={onAnotherPlace} data-testid="trip-another-place" className="border-dashed">
            + Another place
          </Pill>
        </li>
      )}
    </ul>
  );
}

// A gap in a word or two, for the compact row: "a stay", "a transfer", "a date".
function missingNoun(gap: PlanGap) {
  switch (gap.kind) {
    case "stay":
      return gap.short ? "more beds" : "a stay";
    case "undated":
      return "a date";
    case "unavailable":
      return "another option";
    case "tour-guests":
      return "a tour for more";
    default:
      return "a transfer";
  }
}
