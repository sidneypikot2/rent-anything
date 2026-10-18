// Where the platform launches, and a traveller's way in to a trip there, in a plain module: a
// "use client" file's exports reach a Server Component as client references, not values, and
// the home page's title and destination card read these on the server.

export const LAUNCH_AREA = { slug: "bantayan-island", name: "Bantayan Island", kind: "island", region: "Cebu" };

// "Start your trip" lands on an area's things to book, with the banner that says the trip has
// started (RAA-80). It is the home hero's button, with the launch area already in Where, and
// the closing band's; the note under the hero's search says what it costs and, signed out, when
// the account comes (with the first thing added, TripAddProvider). Once Where names something
// that isn't a destination the button searches instead, and the note says how to get a trip back.
export const START_TRIP = {
  action: "Start your trip",
  // Booking isn't open until checkout exists (PRODUCT.md), so the line says so rather than
  // reading "nothing to pay" as a perk, and first says what a traveller can do today.
  note: "Plan and save your trip free today; booking opens later. Sign in at your first add.",
  guestNote: "Plan and save your trip free today; booking opens later.",
  searchNote: "Pick a destination to start a trip there.",
  // A guest with a trip already planning goes on with it (RAA-130): the area page's next add
  // suggests that trip (Trips::Suggest), so the button says so and skips the started banner.
  continueAction: "Continue your trip",
};

// Where a trip's own page in the cart is.
export function tripHref(id: number) {
  return `/cart?trip=${id}`;
}

// A Start your trip link without the started banner, for a guest continuing a trip.
export function continueTripHref(href: string) {
  return href.replace(/([?&])start=trip&?/, "$1").replace(/[?&](?=#|$)/, "");
}

export function startTripHref(slug: string) {
  return `/${slug}?start=trip#listings`;
}
