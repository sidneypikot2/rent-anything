import type { PartnerListing } from "./use-partner-listings";

// Each status with what it means for guests, said beside the badge so a draft isn't
// mistaken for a listing travellers can see. The partner moves between them (RAA-115).
export const STATUS = {
  draft: { label: "Draft", tone: "mist", note: "Guests can't see it yet" },
  active: { label: "Live", tone: "emerald", note: "Guests can book it" },
  paused: { label: "Paused", tone: "aqua", note: "Guests can't see it until you resume it" },
  delisted: { label: "Delisted", tone: "mist", note: "Off the marketplace" },
} as const;

// What a listing still needs before it can go live (the API's live_blockers), said as a
// to-do.
export const BLOCKER_LABELS: Record<PartnerListing["live_blockers"][number], string> = {
  photo: "Add a photo",
  description: "Write a description",
  price: "Set a price",
  route: "Add a destination to its route",
};

// A stay still on the back-filled nightly price of 0 (RAA-105), or a tour made before tours had
// a price (RAA-111): guests see no price and can't book it, whatever its status.
export function needsPrice(listing: PartnerListing) {
  return (listing.stay_rate !== null && !listing.stay_rate.nightly_price_cents) || (!!listing.tour && !listing.tour.base_price_cents);
}

// Something the partner has to do before guests can book it.
export function needsAttention(listing: PartnerListing) {
  return listing.status === "draft" || needsPrice(listing);
}

// The badge and note for a listing on the list: a live listing without a price says so rather
// than "Live", and a plain live one needs no note.
export function statusDisplay(listing: PartnerListing) {
  if (needsPrice(listing) && listing.status === "active") {
    return { label: "Needs a price", tone: "warning", note: "Guests can't book it yet" } as const;
  }
  const status = STATUS[listing.status];
  return { ...status, note: listing.status === "active" ? undefined : status.note };
}

// The order the add-listing picker offers kinds in (tours first, then rentals, stays and
// transfers), so the list reads the same way.
const KIND_ORDER = ["activity", "rental", "stay", "transfer"] as const;

// Delisted listings last; before them, those that need the partner first, then by kind as the
// picker orders them (a tour leading its kind), then by category and title.
export function sortForPartner(listings: PartnerListing[]) {
  const rank = (listing: PartnerListing) => [
    listing.status === "delisted" ? 1 : 0,
    needsAttention(listing) ? 0 : 1,
    KIND_ORDER.indexOf(listing.category.booking_type),
    listing.category.slug === "tour" ? 0 : 1,
  ];
  return [...listings].sort((a, b) => {
    const [ra, rb] = [rank(a), rank(b)];
    for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return ra[i] - rb[i];
    return a.category.name.localeCompare(b.category.name) || a.title.localeCompare(b.title);
  });
}
