// A party and how it fits a stay's rooms (RAA-182): the browser's side of Stays::Arrangement.
// It only shapes what the picker offers and prefills; the API checks the split again and prices it.

export type Room = { adults: number; children: number; infants: number };
export type Party = Room & { pets: number };

export const KINDS = ["adults", "children", "infants"] as const;
export type Kind = (typeof KINDS)[number];

// A room takes at most two infants, whatever its beds (a cot each); a shared room or a whole
// party has no such rule.
export const MAX_INFANTS_PER_ROOM = 2;

// What a stay lets a party do, from its listing's details:
// - `sleeps`: the guests one room sleeps (a shared room's: the whole booking), null when it doesn't say;
// - `countsChildren` / `countsInfants`: whether they take a bed (children do unless it says not,
//   infants only if it says so);
// - `pets`: the most pets it takes, 0 when it takes none, null when it allows them with no limit;
// - `rooms`: the most rooms the guest can book, null when not known;
// - `shared`: a shared room is booked by the bed, so it takes no split into rooms;
// - `petFee`: what a pet costs, from the listing's fees, when the page has them.
export type StayRules = {
  sleeps: number | null;
  countsChildren: boolean;
  countsInfants: boolean;
  pets: number | null;
  rooms: number | null;
  shared: boolean;
  petFee?: { cents: number; perNight: boolean } | null;
};

type Fee = { charged_per: string; amount_cents: number };

const positive = (value: unknown) => (typeof value === "number" && value > 0 ? value : null);

export function stayRules(
  details: Record<string, unknown> | undefined,
  rooms: number | null | undefined,
  fees?: Fee[],
): StayRules {
  const shared = details?.place_type === "shared_room";
  const petFee = fees?.find((fee) => fee.charged_per === "pet" || fee.charged_per === "pet_night");
  return {
    petFee: petFee ? { cents: petFee.amount_cents, perNight: petFee.charged_per === "pet_night" } : null,
    sleeps: positive(details?.guests),
    countsChildren: details?.children_count !== false,
    countsInfants: details?.infants_count === true,
    pets: details?.pets_allowed === true ? positive(details?.max_pets) : 0,
    rooms: shared ? 1 : positive(rooms),
    shared,
  };
}

const counts = (rules: StayRules, kind: Kind) =>
  kind === "adults" || (kind === "children" ? rules.countsChildren : rules.countsInfants);

// The guests of a room who take a bed.
export const counted = (room: Room, rules: StayRules) =>
  KINDS.reduce((sum, kind) => sum + (counts(rules, kind) ? room[kind] : 0), 0);

// The most of `kind` the room can hold with the rest of it as it is, for its + button.
export function roomMax(room: Room, kind: Kind, rules: StayRules) {
  const space = rules.sleeps === null || !counts(rules, kind) ? Infinity : rules.sleeps - counted(room, rules) + room[kind];
  return Math.min(space, kind === "infants" && !rules.shared ? MAX_INFANTS_PER_ROOM : 99);
}

// A trip's party on its own, with no stay to fit (TripDatesBar): one group of up to 50, as
// the API takes a trip's guests, and pets.
export const PARTY_RULES: StayRules = {
  sleeps: 50,
  countsChildren: true,
  countsInfants: true,
  pets: 20,
  rooms: 1,
  shared: true,
};

export const emptyRoom = (): Room => ({ adults: 1, children: 0, infants: 0 });

export const partyOf = (rooms: Room[]): Room =>
  Object.fromEntries(KINDS.map((kind) => [kind, rooms.reduce((sum, room) => sum + room[kind], 0)])) as Room;

export const headcount = (room: Room) => room.adults + room.children + room.infants;

// The fewest rooms that sleep the party, its guests spread evenly with an adult in each (as the
// API's even split does), up to the rooms the stay has. Whoever doesn't fit is left out, for the
// picker to say so.
export function evenRooms(party: Room, rules: StayRules): Room[] {
  const heads = counted(party, rules);
  const wanted = rules.sleeps && !rules.shared ? Math.ceil(heads / rules.sleeps) : 1;
  const count = Math.max(1, Math.min(wanted, Math.max(party.adults, 1), rules.rooms ?? Infinity));
  const rooms = Array.from({ length: count }, emptyRoom);
  const left = { ...party, adults: Math.max(party.adults - count, 0) };
  for (const kind of KINDS) {
    for (let n = 0; n < left[kind]; n++) {
      // The room with the most space for one more, the first of equals.
      let best: Room | undefined;
      for (const room of rooms) {
        if (room[kind] + 1 > roomMax(room, kind, rules)) continue;
        if (!best || fill(room, kind, rules) < fill(best, kind, rules)) best = room;
      }
      if (best) best[kind] += 1;
    }
  }
  return rooms;
}

const fill = (room: Room, kind: Kind, rules: StayRules) => (counts(rules, kind) ? counted(room, rules) : room[kind]);

// How many of the party the rooms leave out, 0 when all are in.
export function unplacedCount(party: Room, rooms: Room[]) {
  const placed = partyOf(rooms);
  return KINDS.reduce((sum, kind) => sum + Math.max(party[kind] - placed[kind], 0), 0);
}

// "Your trip has 7 guests. 2 still need somewhere to sleep.", or null when the rooms hold everyone.
export function unplacedText(party: Room, rooms: Room[]) {
  const left = unplacedCount(party, rooms);
  if (left === 0) return null;
  const guests = headcount(party);
  return `Your trip has ${guests} ${guests === 1 ? "guest" : "guests"}. ${left} still ${left === 1 ? "needs" : "need"} somewhere to sleep.`;
}

const WORDS: Record<Kind | "pets", [string, string]> = {
  adults: ["adult", "adults"],
  children: ["child", "children"],
  infants: ["infant", "infants"],
  pets: ["pet", "pets"],
};

export const peopleWord = (kind: Kind | "pets", count: number) => `${count} ${WORDS[kind][count === 1 ? 0 : 1]}`;

// "2 adults, 1 child", leaving out the kinds with none.
export function roomText(room: Room) {
  return KINDS.filter((kind) => room[kind] > 0)
    .map((kind) => peopleWord(kind, room[kind]))
    .join(", ");
}

// The picker's summary: "2 rooms · 5 adults, 1 child · 1 pet" ("1 room" for one); a shared room
// or a whole party has no rooms to count.
export function partySummary(rooms: Room[], pets: number, shared = false) {
  return [
    shared ? null : `${rooms.length} ${rooms.length === 1 ? "room" : "rooms"}`,
    roomText(partyOf(rooms)),
    pets > 0 ? peopleWord("pets", pets) : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

// The split to send: the rooms as the picker shows them, so the API prices and books exactly that
// (its own even split could place people differently), except for a shared room, which takes none.
export const roomGuestsToSend = (rooms: Room[], rules: StayRules): Room[] | null => (rules.shared ? null : rooms);

// The party as a page's URL carries it (`guests` is everyone), adults at least 1.
export function partyFromGuests(guests: number, extra: { children?: number; infants?: number; pets?: number } = {}): Party {
  const children = extra.children ?? 0;
  const infants = extra.infants ?? 0;
  return { adults: Math.max(guests - children - infants, 1), children, infants, pets: extra.pets ?? 0 };
}
