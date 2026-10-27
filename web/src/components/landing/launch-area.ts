// Where the platform launches, and a traveller's way in to a trip there, in a plain module: a
// "use client" file's exports reach a Server Component as client references, not values, and
// the home page's title and destination card read these on the server.

export const LAUNCH_AREA = { slug: "bantayan-island", name: "Bantayan Island", kind: "island", region: "Cebu" };

// "Start your trip" lands on an area's things to book, with the banner that says the trip has
// started (RAA-80). It is the home hero's button, with the launch area already in Where, and
// the closing band's; the note under the hero's search says what it costs and, signed out, that
// no account is needed (the first add makes a guest without one, RAA-177). Once Where names something
// that isn't a destination the button searches instead, and the note says how to get a trip back.
export const START_TRIP = {
  action: "Start your trip",
  // A guest with trips planning picks one (or a new one) after pressing it, so it says continue.
  continueOne: "Continue your trip",
  continueMany: "Continue a trip",
  // What a traveller can do today, then what isn't live (BOOKING_STATE).
  note: "Save your trip free, no account needed. Send requests to partners when you're ready; nothing is paid in the app yet.",
  guestNote: "Save your trip free, then send requests to partners when you're ready. Nothing is paid in the app yet.",
  searchNote: "Pick a destination to start a trip there.",
};

// What booking is today, said one way on every page (PRODUCT.md: promise only what is true): a
// trip's items go to their partners as requests from the cart, and payments aren't live, so
// nothing is paid in the app. Never "booking opens later" (requests already go out) nor
// "nothing is charged until the partner accepts" (nothing is charged after it either).
export const BOOKING_STATE = {
  unpaid: "nothing is paid in the app yet",
  answer: "each partner has 24 hours to answer",
};

// Where a trip's own page in the cart is.
export function tripHref(id: number) {
  return `/cart?trip=${id}`;
}

// A trip starts at the top of its destination's page, whose first section asks what the guest
// wants to see; What to book follows.
export function startTripHref(slug: string) {
  return `/${slug}?start=trip`;
}


// How a traveller reaches a place and leaves it, by its slug: the trip plan's "Getting here"
// first and its going-home day last (TripPlan). Written by hand for now; a place with none
// leaves both out.
export type GettingHere = { route: string; note: string; home: string };
export const GETTING_HERE: Record<string, GettingHere> = {
  "bantayan-island": {
    route: "Cebu City → Hagnaya port by bus or van → ferry to Santa Fe",
    note: "About 4 hours in all. Check the last ferry before you set off.",
    home: "Ferry from Santa Fe to Hagnaya, then on to Cebu. Mind the last ferry.",
  },
};
