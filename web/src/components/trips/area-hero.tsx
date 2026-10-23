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
import { cn } from "@/components/ui/cn";
import { glassClasses } from "@/components/ui/glass";
import { formatDateRange } from "@/lib/dates";
import { chooseTrip } from "./chosen-trip";
import { HereItemsSheet } from "./here-items-sheet";
import { guestsLabel, thingCount } from "./format";
import { tripOwnQuery } from "./trip-dates";
import { missingAnchor, missingHere, missingText } from "./trip-missing";
import { bookable } from "./trip-details";
import { tripPlaces, type TripPlace } from "./trip-places";
import { useTripHere } from "./use-trip-here";
import type { Trip, TripItem } from "./use-trips";

// An area page's banner: the place's photo, name and counts (`banner`, `statChips` and
// `placeLinks`, built on the server), with the trip's one line at its foot. The guest picks the
// place, books what they need from What to book, and checks out from the cart: the banner never
// becomes a trip's own page. With no trip here yet (signed out, none yet, or still loading) the
// line says the trip starts with the first add (which asks to sign in); once the guest has a trip
// with something here, or chose one to work on, it is TripNotice, whose Checkout opens it in the
// cart ("View trip" once all of it is booked). A guest with trips switches which one they work on
// here (Switch trip, TripChoiceSheet): the page takes that trip's dates and guests, and the add
// sheet preselects it.
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
            <span aria-hidden className="text-sky-pale">
              →
            </span>
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
  const notice = (lead: boolean) =>
    trip && (
      <TripNotice
        trip={trip}
        places={places}
        placeName={areaName}
        offered={offered}
        lead={lead}
        onSwitch={current.length > 1 ? switchTrip : undefined}
        onAnotherPlace={edit ? () => edit("where") : undefined}
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
            className={cn(
              glassClasses("dark"),
              "flex items-center gap-2 self-start rounded-full px-3.5 py-1.5 text-sm font-semibold",
            )}
          >
            <span aria-hidden className="size-2 shrink-0 rounded-full bg-mint" />
            {areaName}
            <span className="font-normal text-sky-mist">· {banner.eyebrow}</span>
          </h1>
        }
      >
        {notice(true)}
        {chips}
        {sheet}
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
                      : "Add what you need, then book it all from your trip. You sign in when you add; saving is free."}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {choosable && (
                  <button
                    type="button"
                    onClick={switchTrip}
                    data-testid="trip-choose"
                    className="flex min-h-11 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold text-sky-pale transition-colors duration-300 ease-calm hover:bg-glass-hover hover:text-white"
                  >
                    {chosen === "new" ? "Choose a trip instead" : "Choose a trip"}
                  </button>
                )}
                <a
                  href="#listings"
                  data-testid="trip-lead-next"
                  className="flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-glass-edge bg-glass-fill px-4 text-sm font-semibold text-white transition-colors duration-300 ease-calm hover:bg-glass-hover"
                >
                  See what to book
                  <span aria-hidden className="text-sky-pale">
                    ↓
                  </span>
                </a>
              </div>
            </div>
          )}
        </div>
      )}
      {/* Compact, with no trip to show (signed out, none yet, loading): one slim row down to What
          to book, so a phone's first screen has something to book behind it. */}
      {!choosable && !(!loading && trip) && (
        <a
          href="#listings"
          data-testid="trip-lead-compact"
          className={cn(
            glassClasses("forest"),
            COMPACT_ONLY,
            "@container min-h-11 items-center rounded-card py-1 pr-4 pl-3 text-sm",
          )}
        >
          {/* One row; two only when the text is large for the room (under 13rem, which grows
              with the text size), rather than What to book running past the banner. */}
          <span className="flex w-full items-center justify-between gap-x-3 gap-y-1 @max-[13rem]:flex-wrap">
            <span className="flex min-w-0 items-center gap-2">
              <span aria-hidden className="size-2 shrink-0 rounded-full bg-sky-pale" />
              <span className="truncate">
                <span className="font-semibold">Start your trip</span>
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-1.5 font-semibold">
              What to book
              <span aria-hidden className="text-sky-pale">
                ↓
              </span>
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
// only for a trip in more than one place, in a sideways row under the slim one. This place's
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
  const missing = missingHere(trip, places, offered);
  const hereItems = trip.items.filter((item) => places.includes(item.area.slug));
  const items = hereItems.length;
  // What it has here, by name, for a phone's chip: "Honda Click 125 + 1 more".
  const hereNames = items > 0 ? `${hereItems[0].listing.title}${items > 1 ? ` + ${items - 1} more` : ""}` : undefined;
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
  // The rows name what it has here, so the count stays only to share a trip out between places.
  const parts = [
    !(range && trip.name.includes(range)) && (range ?? "No dates yet"),
    guestsLabel(trip.guests),
    (!onlyHere || items === 0) && here,
  ].filter((part): part is string => Boolean(part));
  const href = tripHref(trip.id);
  // The link opens the trip in the cart, where it's booked: while anything in it can still be
  // booked that's the next step, so it says so; once all of it is booked it only shows the trip.
  const toBook = trip.items.some(bookable);
  const open = (
    <>
      {toBook ? "Checkout" : "View trip"}
      <span aria-hidden className="text-sky-pale">
        →
      </span>
    </>
  );
  return (
    <>
      <div
        aria-label="Your trip"
        data-testid="trip-notice"
        className={cn(
          glassClasses("forest"),
          "flex flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-card px-4 py-3 sm:px-5",
          WIDE_ONLY,
        )}
      >
        <div className="min-w-0">
          {lead ? (
            <>
              <p className="text-small font-semibold tracking-wide text-sky-mist uppercase">Your trip</p>
              <h2 className="mt-0.5 font-display text-2xl leading-tight font-extrabold tracking-tight text-balance sm:text-3xl">
                {trip.name}
              </h2>
            </>
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
              // The rows above already open the edit sheet, so this place's chip only marks it:
              // one Edit per item, not a second on the chip.
              onAnotherPlace={onAnotherPlace}
              data-testid="trip-places"
              className="mt-2 flex-wrap"
            />
          )}
          {missing.length > 0 && (
            <p data-testid="trip-missing" className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              <span className="flex items-center gap-2 font-semibold">
                <span aria-hidden className="size-2 shrink-0 rounded-full bg-warning-tint" />
                Still missing:
              </span>
              {missing.map((gap, index) => (
                <Fragment key={`${gap.kind}-${index}`}>
                  {index > 0 && (
                    <span aria-hidden className="text-sky-mist">
                      ·
                    </span>
                  )}
                  <a
                    href={missingAnchor(gap)}
                    className="tap-target whitespace-nowrap text-sky-pale underline decoration-sky-pale/40 underline-offset-4 hover:text-white hover:decoration-white"
                  >
                    {missingText(gap)}
                  </a>
                </Fragment>
              ))}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          {/* The banner's one main action while there is something to book: blue on forest, as the
              closing band's. Once all of it is booked it only shows the trip, so it stays quiet. */}
          {toBook ? (
            <ButtonLink href={href} arrow data-testid="trip-notice-open" className="shrink-0">
              Checkout
            </ButtonLink>
          ) : (
            <Link
              href={href}
              data-testid="trip-notice-open"
              className="flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-glass-edge bg-glass-fill px-4 text-sm font-semibold text-white transition-colors duration-300 ease-calm hover:bg-glass-hover"
            >
              {open}
            </Link>
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
      <div className={cn(glassClasses("forest"), COMPACT_ONLY, "min-h-11 items-center rounded-card text-sm")}>
        <Link
          href={href}
          aria-label={`${toBook ? "Checkout" : "View your trip"}: ${trip.name}`}
          data-testid="trip-notice-compact"
          className={cn(
            "flex min-h-11 min-w-0 flex-1 items-center justify-between gap-3 py-1 pl-3",
            onSwitch ? "pr-2" : "pr-4",
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            <span
              aria-hidden
              className={cn("size-2 shrink-0 rounded-full", missing.length > 0 ? "bg-warning-tint" : "bg-mint")}
            />
            {/* Its name, as a guest with trips may switch here, then what it lacks, when anything,
                rather than its count here: a phone has room for one. */}
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="truncate font-semibold">{trip.name}</span>
              <span className="truncate text-small text-sky-mist">
                {missing.length > 0
                  ? `Needs ${missing.length === 1 ? missingNoun(missing[0]) : `${missing.length} things`}`
                  : here}
              </span>
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-2 font-semibold">
            {onSwitch ? (
              <>
                View
                <span aria-hidden className="text-sky-pale">
                  →
                </span>
              </>
            ) : (
              open
            )}
          </span>
        </Link>
        {onSwitch && (
          <button
            type="button"
            onClick={onSwitch}
            data-testid="trip-switch-compact"
            className="min-h-11 shrink-0 border-l border-glass-edge px-4 font-semibold text-sky-pale hover:text-white"
          >
            Switch
          </button>
        )}
      </div>
      {(tripHere.length > 1 || items > 0) && (
        <PlaceChips
          tripPlaces={tripHere}
          places={places}
          dated={dated}
          onEditHere={editHere}
          hereLabel={onlyHere ? hereNames : undefined}
          data-testid="trip-places-compact"
          className={cn(COMPACT_ONLY, "-my-1 overflow-x-auto py-1 [scrollbar-width:none]")}
        />
      )}
      {editing && <HereItemsSheet trip={trip} places={places} placeName={placeName} onClose={closeEditing} />}
    </>
  );
}

// What the trip has in this place, one row each: its photo, name, days and Edit, which opens
// HereItemsSheet (change a date, remove). A booked one says so and links to the trip, where its
// booking is managed. Two rows at most, then "+ N more here", so a long trip doesn't push What to
// book off the first screen.
const ROWS_SHOWN = 2;

function HereItemRows({ items, tripHref: href, onEdit }: { items: TripItem[]; tripHref: string; onEdit: () => void }) {
  const more = items.length - ROWS_SHOWN;
  const link = "text-sm font-semibold text-sky-pale underline decoration-sky-pale/40 underline-offset-4 hover:text-white hover:decoration-white";
  return (
    <ul aria-label="In your trip here" data-testid="trip-here-items" className="mt-2.5 flex w-full max-w-md flex-col gap-1.5 sm:w-md">
      {items.slice(0, ROWS_SHOWN).map((item, index) => {
        const photo = listingCover(item.listing, index);
        const dates = formatDateRange(item.starts_on, item.ends_on);
        return (
          <li
            key={item.id}
            data-testid="trip-here-item"
            className="flex items-center gap-3 rounded-control border border-glass-edge bg-glass-fill py-1.5 pr-3 pl-1.5"
          >
            <Image
              src={photo.src}
              alt=""
              width={44}
              height={44}
              unoptimized={isApiPhoto(photo.src)}
              className="size-11 shrink-0 rounded-[0.6rem] object-cover"
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
                className="tap-target flex min-h-9 shrink-0 items-center rounded-full border border-glass-edge px-3.5 text-sm font-semibold text-white transition-colors duration-300 ease-calm hover:bg-glass-hover"
              >
                Edit<span className="sr-only"> {item.listing.title}</span>
              </button>
            )}
          </li>
        );
      })}
      {more > 0 && (
        <li>
          <button type="button" aria-haspopup="dialog" onClick={onEdit} data-testid="trip-here-more" className={link}>
            + {more} more here · See all
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
  const chip = "tap-target flex min-h-9 shrink-0 items-center gap-2 rounded-full border px-3 text-sm whitespace-nowrap";
  return (
    <ul aria-label="Places in this trip" data-testid={testId} className={cn("flex items-center gap-2", className)}>
      {list.map((place) => {
        const here = places.includes(place.slug);
        const label =
          here && hereLabel ? (
            hereLabel
          ) : (
            <>
              {place.name}
              <span className={here ? "text-sky-mist" : "text-sky-pale/80"}>{place.count}</span>
            </>
          );
        return (
          <li key={place.slug} className="shrink-0">
            {here && onEditHere ? (
              <button
                type="button"
                aria-haspopup="dialog"
                aria-current="page"
                onClick={onEditHere}
                data-testid="trip-place-edit"
                className={cn(
                  chip,
                  "border-sky-pale bg-glass-fill font-semibold text-white transition-colors duration-300 ease-calm hover:bg-glass-hover",
                )}
              >
                <span aria-hidden className="size-1.5 rounded-full bg-mint" />
                {label}
                <span className="font-normal text-sky-pale underline decoration-sky-pale/40 underline-offset-4">Edit</span>
              </button>
            ) : here ? (
              <span aria-current="page" className={cn(chip, "border-sky-pale bg-glass-fill font-semibold text-white")}>
                <span aria-hidden className="size-1.5 rounded-full bg-mint" />
                {label}
              </span>
            ) : (
              <Link
                href={`/${place.slug}${dated}`}
                prefetch
                className={cn(
                  chip,
                  "border-glass-edge text-sky-pale transition-colors duration-300 ease-calm hover:bg-glass-hover hover:text-white",
                )}
              >
                {label}
                <span aria-hidden>→</span>
              </Link>
            )}
          </li>
        );
      })}
      {onAnotherPlace && (
        <li className="shrink-0">
          <button
            type="button"
            onClick={onAnotherPlace}
            data-testid="trip-another-place"
            className={cn(
              chip,
              "border-dashed border-glass-edge text-sky-mist transition-colors duration-300 ease-calm hover:bg-glass-hover hover:text-white",
            )}
          >
            + Another place
          </button>
        </li>
      )}
    </ul>
  );
}

// A gap in a word or two, for the compact row: "a stay", "a transfer".
const missingNoun = (gap: { kind: string }) => (gap.kind === "transfer" ? "a transfer" : "a stay");
