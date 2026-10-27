import type { ListingDetail } from "@/api/discovery";
import { evenRooms, partyOf, roomGuestsToSend, stayRules, type Room } from "@/components/trips/party";
import { datesParty, type TripDates } from "@/components/trips/trip-dates";
import { formatPeso } from "@/lib/money";
import { nightUnit, plural } from "@/lib/pricing";

type Rate = NonNullable<ListingDetail["stay_rate"]>;

// "₱1,200 / night · up to 2 guests included" under a stay's title (RAA-105). Extra guests are
// free without an extra-guest fee, so then it says how many the place sleeps instead.
export function stayPriceLine(rate: Rate, sleeps: number | null) {
  const guests =
    rate.extra_guest_fee_cents > 0
      ? `up to ${plural(rate.base_guests, "guest")} included`
      : sleeps
        ? `sleeps ${sleeps}`
        : null;
  return [`${formatPeso(rate.nightly_price_cents)} ${nightUnit(false)}`, guests].filter(Boolean).join(" · ");
}

// The rooms and pets a stay's price starts from (RAA-184): the page's party in the fewest rooms,
// spread evenly, and its pets where the place takes them.
export function startingArrangement(listing: ListingDetail, dates: TripDates) {
  const rules = stayRules(listing.details, listing.units_count);
  const { pets, ...people } = datesParty(dates);
  return { rooms: evenRooms(people, rules), pets: rules.pets === 0 ? 0 : Math.min(pets, rules.pets ?? pets) };
}

// GET /quotes' query for these rooms: the party they hold and, but for a shared room, the split.
export function stayQuoteQuery(listing: ListingDetail, from: string, to: string, rooms: Room[], pets: number) {
  const party = partyOf(rooms);
  const split = roomGuestsToSend(rooms, stayRules(listing.details, listing.units_count));
  return {
    listing_id: listing.id,
    starts_on: from,
    ends_on: to,
    ...party,
    pets,
    ...(split ? { room_guests: JSON.stringify(split) } : {}),
  };
}

// The quote a listing's panel shows for the page's dates and party, which its pinned foot reads
// back (PanelActions), whatever rooms the guest picked.
export function shownQuoteKey(listingId: number, dates?: TripDates) {
  return ["quote", "shown", listingId, dates?.from, dates?.to, dates?.guests, dates?.children, dates?.infants, dates?.pets];
}
