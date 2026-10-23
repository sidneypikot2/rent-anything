"use client";

import Image from "next/image";
import { useState, type FormEvent } from "react";
import { CategoryGlyph } from "@/components/discovery/tag-glyphs";
import { isApiPhoto } from "@/components/landing/sample-photos";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { DateRangeField } from "@/components/ui/date-range-field";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { StepperField } from "@/components/ui/stepper-field";
import { chooseTrip, useChosenTrip } from "./chosen-trip";
import { formatDateRange, guestLimitHint, itemCount, noNightError, todayIso, tripDetails } from "./format";
import { bedsBooked } from "./beds";
import { sameItem } from "./trip-missing";
import { TripOption } from "./trip-option";
import {
  useAddTripItem,
  useTripSuggestion,
  type AddPreview,
  type AddRequest,
  type Trip,
  type TripSuggestion,
} from "./use-trips";

type Props = {
  request: AddRequest;
  // The guest's current trips; none starts a new one.
  trips: Trip[];
  // A place's page: the trip the add goes to, or "new" to start one; no choosing in the sheet.
  target?: Trip | "new";
  onClose: () => void;
  // The trip the item went to, and the same trip before the add when it already existed.
  onAdded: (trip: Trip, before?: Trip) => void;
};

type Choice = number | "new";

// Why the suggested trip is suggested: the item falls in its dates, it would stretch them,
// or (undated) it's the trip last edited for this destination.
function suggestedReason(suggestion: TripSuggestion, startsOn: string | undefined, endsOn: string | undefined) {
  if (suggestion.extends_to) {
    return `Extends this trip to ${formatDateRange(suggestion.extends_to.starts_on, suggestion.extends_to.ends_on)}`;
  }
  const dates = formatDateRange(startsOn, endsOn);
  return dates ? `${dates} is in this trip` : "Your latest trip here";
}

// "van" and "vans", "room" and "rooms" from the partner's units label ("1 van", "3 rooms");
// `fallback` when the category has no word of its own.
function unitWords(preview: AddPreview, fallback: string) {
  const noun = /^\d+\s+(.+)$/.exec(preview.unitsLabel ?? "")?.[1];
  if (!noun || /^units?$/.test(noun)) return { one: fallback, many: `${fallback}s` };
  return preview.unitsCount === 1 ? { one: noun, many: `${noun}s` } : { one: noun.replace(/s$/, ""), many: noun };
}

// When the group won't fit in one vehicle: a transfer books one (Booking.units_for), so the
// add is set to its seats and the rest need another booking, or more than this partner has.
function vehicleNote(preview: AddPreview, seats: number, guests: number) {
  const needed = Math.ceil(guests / seats);
  const { one, many } = unitWords(preview, "vehicle");
  const short = `One ${one} seats ${seats}, so this is set to ${seats} of your ${guests} guests.`;
  // The partner has too few for the group: another transfer covers the rest.
  if (preview.unitsCount !== undefined && preview.unitsCount < needed) {
    const has = preview.unitsCount === 1 ? `only one ${one}` : `only ${preview.unitsCount} ${many}`;
    return `${short} This partner has ${has}, so add another transfer for the rest, or ask them when you book.`;
  }
  const times = needed === 2 ? "twice" : `${needed} times`;
  return `${short} You'll need ${needed} ${many}: add this ${times}, or sort it out with the partner when you book.`;
}

// When the group won't fit in one room: checkout books as many as the guests need, each
// priced (Booking.units_for, Bookings::Price), and refuses it when the place has too few.
// A shared room's guests take a bed each, so it has no per-room limit to show.
function stayNote(preview: AddPreview, sleeps: number, guests: number) {
  const needed = Math.ceil(guests / sleeps);
  const { one, many } = unitWords(preview, "room");
  const short = `Each ${one} sleeps ${sleeps}, so ${guests} guests need ${needed} ${many}.`;
  if (preview.unitsCount !== undefined && preview.unitsCount < needed) {
    const has = preview.unitsCount === 1 ? `only one ${one}` : `only ${preview.unitsCount} ${many}`;
    const left = guests - preview.unitsCount * sleeps;
    return `${short} This place has ${has}, so add another stay for the other ${left} ${left === 1 ? "guest" : "guests"}.`;
  }
  return `${short} They're booked together when you check out, and the price covers all ${needed}.`;
}

// The most guests one add can hold, as the trip item's `max_guests` says it: a tour's group,
// a stay's rooms all together (a shared room's beds, a guest each), or the seats of the one
// vehicle a transfer books. The sheet starts at it when the trip has more, and + stops there.
export function guestCap(preview: AddPreview | undefined) {
  if (preview?.tourGuests) return preview.tourGuests.max;
  if (preview?.sleeps && preview.unitsCount) return preview.sharedRoom ? preview.unitsCount : preview.sleeps * preview.unitsCount;
  if (preview?.seats) return preview.seats;
  return null;
}

const guestWord = (count: number) => (count === 1 ? "guest" : "guests");
const guestsWord = (count: number) => `${count} ${guestWord(count)}`;

type Note = { text: string; tone: "info" | "warning" };

// `wanted`: the trip's (or the search's) guests, which the sheet may have started below;
// `booked`: those the picked trip's stays already sleep on these nights.
function capacityNote(preview: AddPreview | undefined, guests: number, wanted: number, booked = 0): Note | null {
  if (!preview) return null;
  const cap = guestCap(preview);
  const tour = preview.tourGuests;
  if (tour) {
    if (guests < tour.min) return { tone: "warning", text: `This tour runs for at least ${tour.min} guests.` };
    if (wanted > guests && guests === tour.max) {
      const left = wanted - guests;
      return {
        tone: "info",
        text: `This tour takes up to ${tour.max}, so it's set to ${tour.max} of your ${wanted} guests. The other ${left} ${guestWord(left)} will need another tour.`,
      };
    }
    return null;
  }
  if (preview.seats && wanted > guests && guests === preview.seats)
    return { tone: "info", text: vehicleNote(preview, preview.seats, wanted) };
  // Guests the trip has no bed for yet on these nights: the needs column's "n more guests".
  const unhoused = Math.max(wanted - booked, 0);
  if (preview.sleeps && booked > 0 && wanted > guests) {
    const has = `Your trip already has room for ${booked} of your ${wanted} guests on these nights`;
    if (unhoused === 0) return { tone: "info", text: `${has}.` };
    if (guests >= unhoused) return { tone: "info", text: `${has}, so this covers the other ${unhoused}.` };
    if (cap && guests === cap) {
      const left = unhoused - guests;
      return {
        tone: "info",
        text: `${has}. This place sleeps ${cap}, so ${left} ${guestWord(left)} will still need another stay.`,
      };
    }
  }
  if (cap && preview.sleeps && booked === 0 && wanted > guests && guests === cap) {
    const { one, many } = unitWords(preview, "room");
    const left = wanted - guests;
    const rooms = preview.unitsCount === 1 ? `one ${one}` : `${preview.unitsCount} ${many}, booked together`;
    return {
      tone: "info",
      text: `This place sleeps ${cap} (${rooms}), so it's set to ${cap} of your ${wanted} guests. Add another stay for the other ${left}.`,
    };
  }
  if (preview.sleeps && !preview.sharedRoom && guests > preview.sleeps)
    return { tone: "warning", text: stayNote(preview, preview.sleeps, guests) };
  return null;
}

// The listing being added, as the page that started the add showed it.
function ListingPreview({ title, preview }: { title: string; preview?: AddPreview }) {
  return (
    <div className="flex items-start gap-3" data-testid="add-sheet-listing">
      <div className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-control bg-mist text-navy">
        {preview?.photo ? (
          <Image
            src={preview.photo.src}
            alt={preview.photo.alt}
            fill
            unoptimized={isApiPhoto(preview.photo.src)}
            sizes="4rem"
            className="object-cover"
          />
        ) : (
          <CategoryGlyph name={preview?.category ?? ""} className="size-7" />
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="font-semibold break-words">{title}</p>
        {(preview?.category || preview?.by) && (
          <p className="text-sm text-muted">{[preview.category, preview.by].filter(Boolean).join(" · ")}</p>
        )}
        {preview?.price && <p className="text-sm">{preview.price}</p>}
      </div>
    </div>
  );
}

// The add sheet (screen 4): every add is confirmed here, with the listing, its dates and
// guests. With trips, the server's suggestion comes first and is preselected; "New trip" is
// always there. With none, the add starts one. With a `target` (a place's page) the trip is
// fixed: the sheet names it, or offers a name for the new one.
export function WhichTripSheet({ request, trips, target, onClose, onAdded }: Props) {
  const [{ from: startsOn, to: endsOn }, setDates] = useState({
    from: request.startsOn ?? "",
    to: request.endsOn ?? "",
  });
  // What the guest typed in Guests; until then it follows the picked trip (below).
  const [typedQuantity, setQuantity] = useState<string | null>(null);
  // What the guest picked; until they pick, the trip chosen on the home page (chosen-trip.ts),
  // else the suggestion.
  const chosen = useChosenTrip();
  const preferred: Choice | null =
    chosen === "new" || (typeof chosen === "number" && trips.some((trip) => trip.id === chosen)) ? chosen : null;
  const fixed: Choice | null = target === undefined ? null : target === "new" ? "new" : target.id;
  const [picked, setPicked] = useState<Choice | null>(fixed ?? preferred);
  // A new trip's name, if the guest gives one; blank keeps the server's (destination and dates).
  const [tripName, setTripName] = useState("");
  const addItem = useAddTripItem();

  // A single-day booking has one date; the API takes it as from–to of that day.
  const itemEnds = request.range ? endsOn : startsOn;
  const noNight = noNightError(request.bookingType, startsOn, endsOn);
  const datesValid = Boolean(startsOn) === Boolean(itemEnds) && !noNight;
  const dated = datesValid && startsOn ? { startsOn, endsOn: itemEnds } : { startsOn: undefined, endsOn: undefined };

  // The new trip's name to show, and a suggestion to preselect when the guest picks.
  const suggestion = useTripSuggestion(
    request.listingId,
    dated.startsOn,
    dated.endsOn,
    datesValid && (fixed === null || fixed === "new"),
  );
  const suggested = suggestion.data?.trip ?? null;
  const choice: Choice | null = picked ?? (suggestion.data ? (suggested?.id ?? "new") : null);

  // The suggested trip first, then the rest as the cart lists them.
  const ordered = suggested
    ? [trips.find((trip) => trip.id === suggested.id) ?? suggested, ...trips.filter((trip) => trip.id !== suggested.id)]
    : trips;

  // Beds the picked trip already has on these nights, so the note counts only who's left.
  const pickedTrip = typeof choice === "number" ? trips.find((trip) => trip.id === choice) : undefined;
  const booked =
    pickedTrip && request.bookingType === "stay" && dated.startsOn && dated.endsOn
      ? bedsBooked(pickedTrip, dated.startsOn, dated.endsOn)
      : 0;
  // Guests start at those still without a bed (or the trip's guests), up to what the listing
  // takes (capacityNote says so).
  const unhoused = request.quantity - booked;
  const quantity =
    typedQuantity ??
    String(Math.min(unhoused > 0 ? unhoused : request.quantity, guestCap(request.preview) ?? Infinity));
  const quantityNumber = Number(quantity);
  const quantityValid = Number.isInteger(quantityNumber) && quantityNumber >= 1 && quantityNumber <= 99;
  const dateError = noNight ?? (datesValid ? undefined : "Pick both dates, or neither");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!datesValid || !quantityValid || choice === null) return;
    const tripId = choice === "new" ? null : choice;
    addItem.mutate(
      { request: { ...request, ...dated, quantity: quantityNumber }, tripId, tripName },
      {
        onSuccess: (trip) => {
          // Once a trip was chosen (always, on a place's page), the one this went to is the one
          // being worked on, so a new trip's later adds go to it too.
          if (chosen !== null || fixed !== null) chooseTrip(trip.id);
          onAdded(
            trip,
            trips.find((existing) => existing.id === tripId),
          );
        },
      },
    );
  }

  const when = formatDateRange(dated.startsOn, dated.endsOn);
  // The picked trip already holds this listing on these days: said before a second one goes in,
  // as a double tap or a forgotten add would otherwise book it twice. Adding again stays allowed
  // (a second room, a second van).
  const already = pickedTrip ? sameItem(pickedTrip, request.listingId, dated.startsOn, dated.endsOn) : undefined;
  const capacity = quantityValid ? capacityNote(request.preview, quantityNumber, request.quantity, booked) : null;

  return (
    <Dialog open onClose={onClose} placement="sheet" title="Add to trip" data-testid="which-trip-sheet">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <ListingPreview title={request.title} preview={request.preview} />
        {/* The fields under it already say the dates and guests; only a missing date needs a word,
            a quiet one, as adding it undated is allowed. */}
        {!when && (
          <p className="text-sm text-muted" data-testid="add-sheet-when">
            No date yet: pick one, or add it now and set one later
          </p>
        )}

        <fieldset disabled={addItem.isPending} className="grid grid-cols-[1fr_auto] items-start gap-3">
          <DateRangeField
            label={request.range ? "Dates" : "Date"}
            single={!request.range}
            min={todayIso()}
            from={startsOn}
            to={endsOn}
            onChange={(dates) => {
              setDates(dates);
              setPicked(fixed ?? preferred);
            }}
            clearable
            inline
            error={dateError}
            className="col-span-2 sm:col-span-1"
          />
          {/* − and +, not a typed number: a phone's keyboard would cover the sheet. */}
          <div className="col-span-2 sm:col-span-1 sm:pt-1">
            <StepperField
              label="Guests"
              hint={guestLimitHint(guestCap(request.preview))}
              value={quantityNumber}
              onChange={(value) => setQuantity(String(value))}
              min={1}
              max={guestCap(request.preview) ?? 99}
              data-testid="which-trip-guests"
            />
          </div>
        </fieldset>

        {already && (
          <div role="status" data-testid="add-sheet-already" className="rounded-control border border-warning/30 bg-warning/10 px-3 py-2.5 text-sm">
            <p className="font-semibold text-warning">
              Already in this trip
              {formatDateRange(already.starts_on, already.ends_on) ? ` for ${formatDateRange(already.starts_on, already.ends_on)}` : ""}
            </p>
            <p className="mt-0.5 text-foreground">
              It&apos;s there for {guestsWord(already.quantity)}. Adding it again books it twice
              {request.bookingType === "stay" ? ", as a second room." : "."}
            </p>
          </div>
        )}
        {capacity && (
          <div
            role="status"
            data-testid="add-sheet-capacity"
            className={cn(
              "rounded-control border px-3 py-2.5 text-sm",
              capacity.tone === "warning" ? "border-warning/30 bg-warning/10 text-warning" : "border-line bg-mist",
            )}
          >
            <p>{capacity.text}</p>
          </div>
        )}

        {fixed !== null ? (
          <div className="flex flex-col gap-2" data-testid="add-sheet-trip">
            <p className="text-sm">
              {typeof target === "object" ? (
                <>
                  Adding to <span className="font-semibold">{target.name}</span>
                  <span className="block text-muted">{tripDetails(target)}</span>
                </>
              ) : (
                <>
                  Starts a new trip
                  {suggestion.data?.new_trip_name && (
                    <span className="block text-muted">{suggestion.data.new_trip_name}</span>
                  )}
                </>
              )}
            </p>
            {fixed === "new" && (
              <Field
                label="Trip name (optional)"
                name="trip_name"
                value={tripName}
                maxLength={80}
                placeholder={suggestion.data?.new_trip_name}
                hint="Leave it blank to name it after the place and dates."
                disabled={addItem.isPending}
                data-testid="which-trip-name"
                onChange={(event) => setTripName(event.target.value)}
              />
            )}
          </div>
        ) : (
          <fieldset disabled={addItem.isPending} className="flex max-h-[40dvh] flex-col gap-2 overflow-y-auto">
            <legend className="mb-1 text-sm font-semibold">{trips.length > 0 ? "Which trip" : "Trip"}</legend>
            {ordered.map((trip) => (
              <TripOption
                key={trip.id}
                checked={choice === trip.id}
                onSelect={() => setPicked(trip.id)}
                title={trip.name}
                detail={
                  trip.id === suggested?.id && suggestion.data
                    ? `${suggestedReason(suggestion.data, dated.startsOn, dated.endsOn)} · ${itemCount(trip.items.length)}`
                    : tripDetails(trip)
                }
                suggested={trip.id === suggested?.id}
              />
            ))}
            <TripOption
              checked={choice === "new"}
              onSelect={() => setPicked("new")}
              title="+ New trip"
              detail={suggestion.data?.new_trip_name ?? "Named after the destination and dates"}
              suggested={suggestion.data !== undefined && suggested === null}
            />
            {choice === "new" && (
              <Field
                label="Trip name (optional)"
                name="trip_name"
                value={tripName}
                maxLength={80}
                placeholder={suggestion.data?.new_trip_name}
                hint="Leave it blank to name it after the place and dates."
                data-testid="which-trip-name"
                onChange={(event) => setTripName(event.target.value)}
              />
            )}
          </fieldset>
        )}

        {(addItem.error || (fixed === null && suggestion.error)) && (
          <p role="alert" className="text-sm text-danger">
            {addItem.error?.message ?? "Couldn't suggest a trip. Pick one, or try again."}
          </p>
        )}

        {/* Pinned to the sheet's foot, so Add is on screen however long the trips list is. */}
        <div className="sticky bottom-0 -mx-5 -mb-5 flex flex-wrap justify-end gap-3 border-t border-line bg-surface px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <Button type="button" variant="soft" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            data-testid="which-trip-add"
            disabled={addItem.isPending || choice === null || !datesValid || !quantityValid}
          >
            {addItem.isPending ? "Adding…" : already ? (request.bookingType === "stay" ? "Add another room" : "Add it again") : "Add to trip"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
