"use client";

import Image from "next/image";
import { useState, type FormEvent } from "react";
import { BagGlyph, CategoryGlyph, FeatureGlyph, GuestsGlyph, MapGlyph } from "@/components/discovery/tag-glyphs";
import { isApiPhoto } from "@/components/landing/sample-photos";
import { Button } from "@/components/ui/button";
import { DateRangeField } from "@/components/ui/date-range-field";
import { Dialog, DialogFooter, DialogSummary, useChanged } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Stepper } from "@/components/ui/stepper-field";
import { Ticket, TicketNote, TicketRow } from "@/components/ui/ticket";
import { formatPeso } from "@/lib/money";
import { TO_BE_AGREED } from "@/lib/pricing";
import { chooseTrip, useChosenTrip } from "./chosen-trip";
import { daysBetween, formatDateRange, guestLimitHint, itemCount, noNightError, rentLimitHint, todayIso, tripDetails } from "./format";
import { bedsBooked } from "./beds";
import { evenRooms, headcount, partyFromGuests, partyOf, partySummary, roomGuestsToSend, roomText, type Room } from "./party";
import { RoomsAndGuests } from "./rooms-and-guests";
import { PickupTimeRow, rentalClock } from "./pickup-time";
import { PriceBreakdown, usePriceBreakdown } from "./price-breakdown";
import { VehicleCounters } from "./people-and-vehicles";
import { unitsFor, vehiclePartyText } from "./vehicle-party";
import { sameItem } from "./trip-missing";
import { TripOption } from "./trip-option";
import {
  AtTheShopRow,
  childHelmetsText,
  ChildHelmetsRow,
  deliveryHow,
  DeliveryOptions,
  DropOffAddress,
  needsAddress,
  NO_DELIVERY,
  wantsDelivery,
  type Delivery,
} from "./delivery-options";
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

// How a stay's guests go into its rooms, once they take more than one: checkout books them
// together, each room priced for its own guests (RAA-182).
function stayNote(preview: AddPreview, rooms: Room[]) {
  const { many } = unitWords({ ...preview, unitsCount: rooms.length }, "room");
  const split = rooms.map((room, index) => `${index + 1}: ${roomText(room)}`).join("; ");
  return `${rooms.length} ${many} (${split}), booked together when you check out, each priced for its own guests.`;
}

// The party less those the trip's stays already sleep: adults first (one stays, to hold the
// room), then children, then infants.
function withoutHoused(party: Room, housed: number): Room {
  let left = housed;
  const take = (count: number, keep: number) => {
    const taken = Math.min(Math.max(count - keep, 0), left);
    left -= taken;
    return count - taken;
  };
  return { adults: take(party.adults, 1), children: take(party.children, 0), infants: take(party.infants, 0) };
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
// `booked`: those the picked trip's stays already sleep on these nights; `rooms`: a stay's rooms
// as the picker has them, which says itself who it leaves out.
function capacityNote(preview: AddPreview | undefined, guests: number, wanted: number, booked = 0, rooms?: Room[]): Note | null {
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
    if (rooms) return { tone: "info", text: `${has}.` };
    if (cap && guests === cap) {
      const left = unhoused - guests;
      return {
        tone: "info",
        text: `${has}. This place sleeps ${cap}, so ${left} ${guestWord(left)} will still need another stay.`,
      };
    }
  }
  if (rooms) return rooms.length > 1 ? { tone: "info", text: stayNote(preview, rooms) } : null;
  if (cap && preview.sleeps && booked === 0 && wanted > guests && guests === cap) {
    const { one, many } = unitWords(preview, "room");
    const left = wanted - guests;
    const rooms = preview.unitsCount === 1 ? `one ${one}` : `${preview.unitsCount} ${many}, booked together`;
    return {
      tone: "info",
      text: `This place sleeps ${cap} (${rooms}), so it's set to ${cap} of your ${wanted} guests. Add another stay for the other ${left}.`,
    };
  }
  return null;
}

// The trip's people, said rather than asked (RAA-191): the trip sets them.
function TripPeople({ people }: { people: number }) {
  return (
    <p className="text-sm" data-testid="which-trip-people">
      <span className="font-semibold">{people} {people === 1 ? "person" : "people"}</span> <span className="text-muted">· your trip</span>
    </p>
  );
}

// Opens the new trip's name field: a text action, underlined as a link is.
function NameTripButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid="which-trip-name-open"
      className="tap-target self-start text-sm font-semibold text-link underline underline-offset-4 hover:text-primary"
    >
      Name this trip
    </button>
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
  // A stay's rooms and pets once the guest changes them.
  const [typedRooms, setRooms] = useState<{ rooms: Room[]; pets: number } | null>(null);
  // What the guest picked; until they pick, the trip chosen on the home page (chosen-trip.ts),
  // else the suggestion.
  const chosen = useChosenTrip();
  const preferred: Choice | null =
    chosen === "new" || (typeof chosen === "number" && trips.some((trip) => trip.id === chosen)) ? chosen : null;
  const fixed: Choice | null = target === undefined ? null : target === "new" ? "new" : target.id;
  const [picked, setPicked] = useState<Choice | null>(fixed ?? preferred);
  // A new trip's name, if the guest gives one; blank keeps the server's (destination and dates).
  const [tripName, setTripName] = useState("");
  // A new trip is named after its place and dates; a name of the guest's own is one tap away
  // ("Name this trip"), not a field in the way of every first add.
  const [naming, setNaming] = useState(false);
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
  // The people (RAA-191): an existing trip's own, so the sheet doesn't ask; a new trip's from the
  // page (the search), which the sheet still lets the guest change.
  const tripPeople = pickedTrip ? pickedTrip.guests : null;
  const wanted = tripPeople ?? request.quantity;
  // Guests start at those still without a bed (or the trip's guests), up to what the listing
  // takes (capacityNote says so).
  const unhoused = wanted - booked;
  // A stay's rooms (RAA-184): those guests in the fewest rooms, spread evenly, until the guest
  // changes them; the people they leave out are a hint in the picker.
  // A mix of room types (RAA-188) comes with its rooms picked in the partner's panel.
  const mix = request.mix;
  const rules = request.bookingType === "stay" && !mix ? (request.preview?.stayRules ?? null) : null;
  const { pets: partyPets, ...people } = pickedTrip ? partyFromGuests(pickedTrip.guests, pickedTrip) : partyFromGuests(request.quantity, request);
  const startParty = booked > 0 && unhoused > 0 ? withoutHoused(people, booked) : people;
  // Rooms picked beside the listing (its price card) come along as they are.
  const arrangement = rules
    ? (typedRooms ?? {
        rooms: request.roomGuests ?? evenRooms(startParty, rules),
        pets: rules.pets === 0 ? 0 : Math.min(partyPets, rules.pets ?? partyPets),
      })
    : null;
  // Gear is booked by the count: the sheet asks how many, from one, and the page's guests go
  // along only as a new trip's.
  const gear = Boolean(request.preview?.gear) && !mix;
  const quantity = arrangement
    ? String(headcount(partyOf(arrangement.rooms)))
    : mix
      ? String(request.quantity)
      : gear
        ? (typedQuantity ?? "1")
        : ((tripPeople === null ? typedQuantity : null) ??
      String(Math.min(unhoused > 0 ? unhoused : wanted, guestCap(request.preview) ?? Infinity)));
  const quantityNumber = Number(quantity);
  const quantityValid = Number.isInteger(quantityNumber) && quantityNumber >= 1 && quantityNumber <= 99;
  // A rental vehicle (RAA-191): its people and the vehicles they take, from the booking card's
  // or the page's people, until the guest changes them here.
  const vehicleSeats = mix ? null : (request.preview?.vehicleSeats ?? null);
  const vehicle = vehicleSeats !== null;
  const [typedUnits, setUnits] = useState<number | null>(null);
  // Closing asks first once the guest has changed what the sheet opened with. The picked trip
  // isn't counted: it can settle after the first render (the chosen trip is read on mount).
  const dirty = useChanged({ startsOn, endsOn, typedQuantity, typedRooms, typedUnits, tripName });
  const vehicleUnits = vehicleSeats ? unitsFor(quantityNumber, vehicleSeats, typedUnits ?? request.units) : undefined;
  // Its pickup time (RAA-195): the booking card's, until the guest picks another; null takes the shop's default.
  const [pickupTime, setPickupTime] = useState<string | null>(request.pickupTime ?? null);
  // Its delivery and pick-up (RAA-195): the booking card's, until the guest changes them here.
  const [delivery, setDelivery] = useState<Delivery>(request.delivery ?? NO_DELIVERY);
  const deliveryFees = vehicle ? (request.preview?.deliveryFees ?? null) : null;
  // A shop's models added together: delivery and pick-up were picked in the shop sheet, the
  // drop-off address is asked here, once for all of them.
  const mixDelivery = mix?.find((item) => wantsDelivery(item.delivery))?.delivery ?? null;
  const [mixAddress, setMixAddress] = useState(mixDelivery?.address ?? "");
  const addressMissing = deliveryFees ? needsAddress(delivery) : mixDelivery !== null && !mixAddress.trim();
  // A motorcycle's child helmets (RAA-205): the booking card's, until changed here, one a vehicle
  // at most. A shop's models keep what the shop sheet picked.
  const [typedHelmets, setChildHelmets] = useState(request.childHelmets ?? 0);
  const childHelmets = deliveryFees?.childHelmet !== null && deliveryFees?.childHelmet !== undefined ? Math.min(typedHelmets, vehicleUnits ?? 0) : 0;
  const mixHelmets = mix?.reduce((sum, item) => sum + (item.childHelmets ?? 0), 0) ?? 0;
  const mixVehicles = Boolean(mix?.some((item) => item.units));
  const dateError = noNight ?? (datesValid ? undefined : "Pick both dates, or neither");
  // What the add costs (RAA-191): each item of a mix, or the one listing as the sheet has it now.
  const breakdown = usePriceBreakdown(
    mix
      ? mix.map((item) => ({ ...dated, listingId: item.listingId, quantity: item.quantity, units: item.units, roomGuests: item.roomGuests, pets: item.pets, pickupTime: item.pickupTime, delivery: item.delivery, childHelmets: item.childHelmets }))
      : [
          {
            ...dated,
            listingId: request.listingId,
            quantity: quantityValid ? quantityNumber : 1,
            units: vehicleUnits,
            roomGuests: arrangement && rules ? roomGuestsToSend(arrangement.rooms, rules) : null,
            pets: arrangement?.pets ?? 0,
            pickupTime: vehicle ? pickupTime : null,
            delivery: deliveryFees ? delivery : null,
            childHelmets,
          },
        ],
    mix?.map((item) => item.title),
  );

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!datesValid || !quantityValid || choice === null || addressMissing) return;
    const tripId = choice === "new" ? null : choice;
    addItem.mutate(
      {
        request: {
          ...request,
          ...dated,
          mix: mixDelivery
            ? mix?.map((item) => (item.delivery ? { ...item, delivery: { ...item.delivery, address: mixAddress } } : item))
            : mix,
          quantity: quantityNumber,
          guests: gear ? request.quantity : vehicle ? request.guests : undefined,
          units: vehicle ? vehicleUnits : undefined,
          pickupTime: vehicle ? pickupTime : null,
          delivery: deliveryFees ? delivery : (request.delivery ?? null),
          childHelmets: mix ? undefined : childHelmets,
          roomGuests: arrangement && rules ? roomGuestsToSend(arrangement.rooms, rules) : null,
          pets: arrangement?.pets ?? 0,
        },
        tripId,
        tripName,
      },
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
  const already = pickedTrip && !mix ? sameItem(pickedTrip, request.listingId, dated.startsOn, dated.endsOn) : undefined;
  // Gear the trip holds unbooked on exactly these dates: the add counts into it (the API's
  // Trips::AddItem), so the sheet says the new total rather than warning of a double booking.
  const merging = gear
    ? pickedTrip?.items.find(
        (item) =>
          item.listing.id === request.listingId &&
          !item.booking &&
          Boolean(dated.startsOn) &&
          item.starts_on === dated.startsOn &&
          item.ends_on === dated.endsOn,
      )
    : undefined;
  // What the partner lists, less what the trip holds on these dates: the most one add can take.
  // At none left, the add is off and the note says why (the API refuses it too).
  const listed = gear ? request.preview?.unitsCount : undefined;
  const left = listed === undefined ? null : listed - (merging?.quantity ?? 0);
  const full = left !== null && left <= 0;
  const capacity = quantityValid && !mix && !gear
    ? capacityNote(request.preview, quantityNumber, wanted, booked, arrangement?.rooms)
    : null;

  // The trip's short name for the button: "Bantayan Island", not its dates too. A trip the
  // server named after its first place and dates ("Bantayan Island · Oct 29–31") is "your trip":
  // "Add to Bantayan Island" read as adding to the island itself.
  const goingToTrip = choice === "new" ? null : (pickedTrip ?? (typeof target === "object" ? target : undefined));
  const goingToRange = goingToTrip && formatDateRange(goingToTrip.starts_on, goingToTrip.ends_on);
  const goingTo =
    goingToTrip && (goingToRange && goingToTrip.name.endsWith(` · ${goingToRange}`) ? "your trip" : goingToTrip.name.split(" · ")[0]);
  // A shop's models (RAA-191) are vehicles, not stays.
  const mixNoun = mix?.some((item) => item.units) ? (mix.length === 1 ? "model" : "models") : "stays";
  const mixUnits = mix?.reduce((sum, item) => sum + (item.units ?? 0), 0) ?? 0;
  const submitLabel = addItem.isPending
    ? "Adding…"
    : mix
      ? mixUnits
        ? `Add ${mixUnits} to trip`
        : `Add ${mix.length} stays`
      : merging
        ? `Add ${quantityNumber} more`
        : already
          ? request.bookingType === "stay"
            ? "Add another room"
            : "Add it again"
          : goingTo
            ? `Add to ${goingTo}`
            : "Start a trip";
  // What the add holds, beside its button: the count (rooms, guests or how many) over the dates.
  const amount = mix
    ? `${mix.length} ${mixNoun}`
    : arrangement
      ? `${arrangement.rooms.length} ${arrangement.rooms.length === 1 ? "room" : "rooms"}`
      : gear
        ? `Qty ${merging ? merging.quantity + quantityNumber : quantityNumber}`
        : vehicleUnits
          ? vehiclePartyText(quantityNumber, vehicleUnits, request.preview?.category)
          : guestsWord(quantityNumber);
  const preview = request.preview;
  const nameTrip =
    naming ? (
      <Field
        label="Trip name"
        name="trip_name"
        value={tripName}
        maxLength={80}
        placeholder={suggestion.data?.new_trip_name}
        hint="Leave it blank to name it after the place and dates."
        disabled={addItem.isPending}
        autoFocus
        data-testid="which-trip-name"
        onChange={(event) => setTripName(event.target.value)}
      />
    ) : (
      <NameTripButton onClick={() => setNaming(true)} />
    );

  return (
    // Named after the listing, never "Add to trip": the card's button said that, and this one
    // says where it goes (the modal redesign, 2026-10-28).
    <Dialog
      open
      onClose={onClose}
      dirty={dirty}
      placement="sheet"
      title={request.title}
      meta={
        <>
          {[preview?.category, preview?.by].filter(Boolean).join(" · ")}
          {preview?.price && <span className="block font-medium text-foreground">{preview.price}</span>}
        </>
      }
      thumb={
        <span data-testid="add-sheet-listing" className="absolute inset-0 flex items-center justify-center text-navy">
          {preview?.photo ? (
            <Image src={preview.photo.src} alt={preview.photo.alt} fill unoptimized={isApiPhoto(preview.photo.src)} sizes="4rem" className="object-cover" />
          ) : (
            <CategoryGlyph name={preview?.category ?? ""} className="size-7" />
          )}
        </span>
      }
      data-testid="which-trip-sheet"
    >
      <form onSubmit={submit} className="flex flex-1 flex-col gap-4">
        {/* Only a missing date needs a word, a quiet one, as adding it undated is allowed. */}
        {!when && (
          <p className="text-sm text-muted" data-testid="add-sheet-when">
            No date yet: pick one, or add it now and set one later
          </p>
        )}

        <fieldset disabled={addItem.isPending} className="flex flex-col gap-4">
          <Ticket data-testid="add-sheet-ticket">
            {fixed !== null && (
              <TicketRow
                icon={<BagGlyph />}
                label="Trip"
                value={typeof target === "object" ? target.name : "New trip"}
                detail={typeof target === "object" ? tripDetails(target) : (suggestion.data?.new_trip_name ?? undefined)}
                data-testid="add-sheet-trip"
              />
            )}
            <DateRangeField
              row
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
              error={dateError}
              hint={
                request.bookingType === "stay" && dated.startsOn && dated.endsOn && !dateError && daysBetween(dated.startsOn, dated.endsOn) > 0
                  ? `${daysBetween(dated.startsOn, dated.endsOn)} ${daysBetween(dated.startsOn, dated.endsOn) === 1 ? "night" : "nights"}`
                  : undefined
              }
            />
            {/* − and +, not a typed number: a phone's keyboard would cover the sheet. */}
            {mix ? (
              mix.map((item) => (
                <TicketRow
                  key={item.listingId}
                  icon={<CategoryGlyph name={item.units ? (preview?.category ?? "") : "Hotel or cottage"} />}
                  value={item.title}
                  label={
                    item.units
                      ? vehiclePartyText(item.quantity, item.units, preview?.category)
                      : partySummary(item.roomGuests ?? [{ adults: item.quantity, children: 0, infants: 0 }], item.pets, item.shared)
                  }
                  data-testid="which-trip-mix"
                />
              ))
            ) : arrangement && rules ? (
              <RoomsAndGuests
                row
                rooms={arrangement.rooms}
                pets={arrangement.pets}
                rules={rules}
                party={startParty}
                searched={{ children: startParty.children, infants: startParty.infants, pets: partyPets }}
                onChange={(rooms, pets) => setRooms({ rooms, pets })}
                data-testid="which-trip-rooms"
              />
            ) : vehicleSeats && vehicleUnits ? (
              <div className="flex flex-col gap-1 px-3.5 py-3" data-testid="which-trip-vehicles">
                {tripPeople !== null && <TripPeople people={tripPeople} />}
                <VehicleCounters
                  fixedPeople={tripPeople !== null}
                  people={quantityNumber}
                  units={vehicleUnits}
                  seats={vehicleSeats}
                  category={preview?.category}
                  onChange={(people, units) => {
                    setQuantity(String(people));
                    setUnits(units);
                  }}
                  testId="which-trip-vehicles"
                />
              </div>
            ) : gear ? (
              <TicketRow
                icon={<CategoryGlyph name={preview?.category ?? ""} />}
                value={merging ? "How many more" : "How many"}
                detail={rentLimitHint(listed)?.toLowerCase()}
                control={
                  <Stepper
                    label="How many"
                    value={quantityNumber}
                    onChange={(value) => setQuantity(String(value))}
                    min={1}
                    // With some already in the trip on these days, what's left of what the partner lists.
                    max={left === null ? 99 : Math.max(1, left)}
                    testId="which-trip-count"
                  />
                }
                data-testid="which-trip-count"
              />
            ) : tripPeople !== null ? (
              <TicketRow
                icon={<GuestsGlyph />}
                label="People"
                value={guestsWord(quantityNumber)}
                detail={quantityNumber < tripPeople ? `of your trip's ${tripPeople}` : "your trip"}
                data-testid="which-trip-guests"
              />
            ) : (
              <TicketRow
                icon={<GuestsGlyph />}
                value="Guests"
                detail={guestLimitHint(guestCap(preview))?.toLowerCase()}
                control={
                  <Stepper
                    label="Guests"
                    value={quantityNumber}
                    onChange={(value) => setQuantity(String(value))}
                    min={1}
                    max={guestCap(preview) ?? 99}
                    testId="which-trip-guests"
                  />
                }
                data-testid="which-trip-guests"
              />
            )}
            {merging && (
              <TicketNote tone={full ? "warning" : "info"} data-testid="add-sheet-already">
                <p className="font-semibold">You have {merging.quantity} in this trip for these dates</p>
                <p className="text-muted">
                  {full
                    ? `The partner lists ${listed}, so there are none left to add for these dates. Change the count in your trip, or pick other dates.`
                    : `Adding ${quantityNumber} makes it ${merging.quantity + quantityNumber}, on one line in your trip.`}
                </p>
              </TicketNote>
            )}
            {already && !merging && (
              <TicketNote tone="warning" data-testid="add-sheet-already">
                <p className="font-semibold">
                  Already in this trip
                  {formatDateRange(already.starts_on, already.ends_on) ? ` for ${formatDateRange(already.starts_on, already.ends_on)}` : ""}
                </p>
                <p className="text-muted">
                  {gear ? (
                    <>It&apos;s there ({already.quantity}) on other days or already booked, so this goes on a line of its own.</>
                  ) : (
                    <>
                      It&apos;s there for {guestsWord(already.quantity)}. Adding it again books it twice
                      {request.bookingType === "stay" ? ", as a second room." : "."}
                    </>
                  )}
                </p>
              </TicketNote>
            )}
            {vehicle && breakdown.price?.pickupTimes && (
              <PickupTimeRow
                times={breakdown.price.pickupTimes}
                value={pickupTime ?? (breakdown.price.returnsAt ? rentalClock(breakdown.price.returnsAt) : null)}
                onChange={setPickupTime}
                returnsAt={breakdown.price.returnsAt}
              />
            )}
            {deliveryFees && <DeliveryOptions fees={deliveryFees} value={delivery} onChange={setDelivery} />}
            {((vehicle && !wantsDelivery(delivery)) || (mixVehicles && !mixDelivery)) && <AtTheShopRow place={request.preview?.place} />}
            {vehicle && (
              <ChildHelmetsRow fee={deliveryFees?.childHelmet} value={childHelmets} max={vehicleUnits ?? 0} onChange={setChildHelmets} />
            )}
            {mixHelmets > 0 && (
              <TicketRow icon={<FeatureGlyph name="helmet" />} label="Child helmets" value={childHelmetsText(mixHelmets)} data-testid="which-trip-child-helmets" />
            )}
            {mixDelivery && (
              <>
                <TicketRow
                  icon={<MapGlyph />}
                  label="Delivery"
                  value={deliveryHow(mixDelivery.delivery, mixDelivery.returnPickup)}
                  data-testid="which-trip-delivery"
                />
                <DropOffAddress value={mixAddress} onChange={setMixAddress} />
              </>
            )}
            {capacity && (
              <TicketNote tone={capacity.tone} data-testid="add-sheet-capacity">
                {capacity.text}
              </TicketNote>
            )}
            <PriceBreakdown breakdown={breakdown} />
          </Ticket>

        </fieldset>

        {fixed === "new" && nameTrip}

        {fixed === null && (
          <fieldset disabled={addItem.isPending} className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-semibold">{trips.length > 0 ? "Which trip" : "Trip"}</legend>
            <Ticket className="max-h-[40dvh] overflow-y-auto">
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
                isNew
                checked={choice === "new"}
                onSelect={() => setPicked("new")}
                title="New trip"
                detail={suggestion.data?.new_trip_name ?? "Named after the destination and dates"}
                suggested={suggestion.data !== undefined && suggested === null}
              />
            </Ticket>
            {choice === "new" && nameTrip}
          </fieldset>
        )}

        {(addItem.error || (fixed === null && suggestion.error)) && (
          <p role="alert" className="text-sm text-danger">
            {addItem.error?.message ?? "Couldn't suggest a trip. Pick one, or try again."}
          </p>
        )}

        {/* Pinned to the sheet's foot, so the button is on screen however long the trips list is.
            No Cancel: the close disc or a drag down closes it. */}
        <DialogFooter
          summary={
            <DialogSummary
              value={
                breakdown.price?.total != null
                  ? formatPeso(breakdown.price.total)
                  : breakdown.price?.toBeAgreed
                    ? TO_BE_AGREED
                    : (when ?? "No date yet")
              }
              detail={
                breakdown.price?.total != null || breakdown.price?.toBeAgreed
                  ? [when, amount, breakdown.price?.total != null && breakdown.price?.toBeAgreed && "plus a price to agree"]
                      .filter(Boolean)
                      .join(" · ")
                  : amount
              }
              data-testid="which-trip-summary"
            />
          }
        >
          <Button
            type="submit"
            glyph="plus"
            data-testid="which-trip-add"
            loading={addItem.isPending}
            disabled={choice === null || !datesValid || !quantityValid || full || addressMissing}
          >
            {submitLabel}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
