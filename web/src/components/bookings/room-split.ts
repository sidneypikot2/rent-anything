import type { components } from "@/api/schema";

type RoomGuests = NonNullable<components["schemas"]["booking"]["room_guests"]>;

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

// One room's party: "4 adults + 1 child".
function roomParty(room: RoomGuests[number]) {
  return [
    plural(room.adults, "adult", "adults"),
    room.children > 0 && plural(room.children, "child", "children"),
    room.infants > 0 && plural(room.infants, "infant", "infants"),
  ]
    .filter(Boolean)
    .join(" + ");
}

// How a stay's guests split into rooms and the pets they bring, for its partner (RAA-186):
// "2 rooms: 1 adult · 4 adults + 1 child · 1 pet". Null when the booking says neither (the
// guests spread evenly, no pets).
export function roomSplit(booking: { room_guests: RoomGuests | null; pets: number }) {
  const rooms = booking.room_guests;
  const pets = booking.pets > 0 ? plural(booking.pets, "pet", "pets") : null;
  if (!rooms?.length) return pets;
  const split = `${plural(rooms.length, "room", "rooms")}: ${rooms.map(roomParty).join(" · ")}`;
  return pets ? `${split} · ${pets}` : split;
}
