import type { AreaCard } from "@/api/discovery";
import type { components } from "@/api/schema";
import { addPreview } from "@/components/trips/add-preview";
import { AddToTripButton } from "@/components/trips/add-to-trip-button";
import { stayRules } from "@/components/trips/party";
import { tripDatesQuery, type TripDates } from "@/components/trips/trip-dates";
import { formatPeso } from "@/lib/money";
import { pricedByText, priceUnitText } from "@/lib/pricing";
import { groupText, guestTourTypeLabel } from "@/lib/tours";
import { listingFeatures, type Feature } from "./listing-features";
import { listingPath } from "@/lib/seo";

// What the guest's browse pages build their business cards and options from: an area page's
// What to book and a business's own page, both from the `area_listing` rows.

export type BrowseListing = components["schemas"]["area_listing"];

// "by Santa Fe Boats · in Santa Fe · 2 vans": the place only for a row from a place other than
// the page's, and the units only when they say there is more than one to pick from — not for a
// tour, nor a single one ("1 van"), nor in the category's fallback words ("2 units").
export function listingByLine(listing: BrowseListing, pageSlug: string) {
  return [
    `by ${listing.business.name}`,
    listing.area_slug !== pageSlug && `in ${listing.area_name}`,
    listing.booking_type !== "activity" &&
      !/\bunits?$/.test(listing.units_label) &&
      !/^1\s/.test(listing.units_label) &&
      listing.units_label,
  ]
    .filter(Boolean)
    .join(" · ");
}

// A listing's own photos (its cover alone while the API sends no others), or none: its category
// icon then shows, never a stand-in photo.
export function listingPhotos(listing: BrowseListing) {
  return listing.photos.length > 0
    ? listing.photos.map((photo) => ({ src: photo.card_url, alt: listing.title }))
    : listing.cover_photo_url
      ? [{ src: listing.cover_photo_url, alt: listing.title }]
      : [];
}

// Its chips, led by a tour's kind and the group it takes ("Shared tour · 2 to 12 guests"), so the
// row says it before the panel does.
export function listingChips(listing: BrowseListing): Feature[] {
  const tour = listing.tour;
  const kind = tour && `${guestTourTypeLabel(tour.tour_type)} · ${groupText(tour.min_guests, tour.max_guests)}`;
  return [...(kind ? [{ icon: "guests", label: kind }] : []), ...listingFeatures(listing)];
}

// One listing as a business card and its options show it, with Add to trip; `text` is what a
// What to book search matches, and `vehicle` what Vehicle rental's filters ask of it (RAA-205).
// A rental's facts for Vehicle rental's and Gear's filters (RAA-205); undefined for anything else.
export function vehicleFactsOf(listing: BrowseListing) {
  return listing.handover
    ? {
        kind: listing.category,
        transmission: typeof listing.details?.transmission === "string" ? listing.details.transmission : null,
        delivery: listing.handover.delivery_fee_cents !== null,
        returnPickup: listing.handover.return_pickup_fee_cents !== null,
        childHelmets: listing.handover.child_helmet_fee_cents !== null,
      }
    : undefined;
}

export function offerOf(
  listing: BrowseListing,
  {
    dates,
    pageSlug,
    groupTitle,
  }: { dates: TripDates; pageSlug: string; groupTitle: string },
) {
  const by = listingByLine(listing, pageSlug);
  const priceUnit = listing.price_from_cents ? priceUnitText(listing.price_unit) : null;
  const preview = addPreview(listing, by);
  return {
    listingId: listing.id,
    text: [listing.title, listing.category, listing.business.name, listing.area_name, listing.summary, groupTitle]
      .filter(Boolean)
      .join(" "),
    href: `${listingPath(listing)}${tripDatesQuery(dates)}`,
    title: listing.title,
    category: listing.category,
    by,
    summary: listing.summary,
    photos: listingPhotos(listing),
    features: listingChips(listing),
    priceCents: listing.price_from_cents ?? null,
    priceUnit,
    price: listing.price_from_cents
      ? { prefix: "from", amount: formatPeso(listing.price_from_cents), unit: priceUnit ?? undefined }
      : undefined,
    unpriced: pricedByText(listing.booking_type),
    instantBook: listing.instant_book,
    place: listing.area_name,
    goesTo: listing.goes_to,
    handover: listing.handover,
    vehicle: vehicleFactsOf(listing),
    stay:
      listing.booking_type === "stay"
        ? {
            listingId: listing.id,
            title: listing.title,
            priceText: listing.price_from_cents
              ? ["from", formatPeso(listing.price_from_cents), priceUnit].filter(Boolean).join(" ")
              : undefined,
            rules: stayRules(listing.details, listing.units_count),
            preview,
          }
        : undefined,
    action: <AddToTripButton key={`add-${listing.id}`} listing={listing} dates={dates} preview={preview} />,
  };
}

// A shop whose listings here are all rentals of one kind: its models are picked together. Rental
// vehicles (RAA-191) are picked for the trip's people; gear (RAA-255) is `counted`, by how many.
export function rentalShop(listings: BrowseListing[]) {
  const counted = listings.every((listing) => listing.booking_type === "rental" && listing.group === "gear");
  const vehicles = listings.every(
    (listing) => listing.booking_type === "rental" && listing.group !== "gear" && typeof listing.details?.seats === "number",
  );
  return counted || vehicles ? { businessId: listings[0].business.id, counted } : undefined;
}

type CardRow = { id: number; business: { id: number }; group: string; title: string };

// What makes a browse card: a stay's card is its business, any other one listing title of a
// business ("Mio 125" by one shop, its two "Fortuner" listings together), as the plan API's.
function sameCard(row: CardRow) {
  return isTitleCard(row) ? `${row.business.id}-${row.title.trim().toLowerCase()}` : String(row.business.id);
}

// Listings by their card (sameCard), each card where its first listing is, the order kept.
export function byCard<T extends CardRow>(rows: T[]): T[][] {
  return byKey(rows, sameCard);
}

// A card's id for keys and anchors, from its first listing: the business's id for a stay's card,
// with that listing's for a title card.
export function cardKey(first: CardRow) {
  return isTitleCard(first) ? `${first.business.id}-${first.id}` : String(first.business.id);
}

// Whether a card stands for one listing title (every group but stays): it is titled with it,
// "by <business>" under it, and opens the business's page on it (`item`).
export function isTitleCard(row: { group: string }) {
  return row.group !== "stay";
}

function byKey<T>(rows: T[], key: (row: T) => string): T[][] {
  const groups = new Map<string, T[]>();
  for (const row of rows) groups.set(key(row), [...(groups.get(key(row)) ?? []), row]);
  return [...groups.values()];
}

// A business's own page, with the trip's dates and guests, opening on the group the guest came
// from (`show`, a What to book group's id); `place` is the place's page it was opened on, which
// its way back returns to; `item` the listing a title card stands for, which its group then leads with.
export function businessHref(id: number, dates: TripDates, show?: string, place?: string, item?: number) {
  const query = new URLSearchParams(tripDatesQuery(dates).replace(/^\?/, ""));
  if (show) query.set("show", show);
  if (place) query.set("place", place);
  if (item) query.set("item", String(item));
  const search = query.toString();
  return `/businesses/${id}${search ? `?${search}` : ""}`;
}

// A title card's link: its cheapest listing's page (else its first's), the card's other options
// under More from the business there; `place` the place's page it was opened on. From the place
// page itself (`fromPlace`) the listing's way back is that page, else the place's What to book.
export function titleCardHref(
  offered: { id: number; title?: string; price_from_cents?: number | null }[],
  dates: TripDates,
  place: string,
  fromPlace = false,
) {
  const priced = offered.filter((listing) => listing.price_from_cents);
  const opens = priced.sort((a, b) => a.price_from_cents! - b.price_from_cents!)[0] ?? offered[0];
  const query = new URLSearchParams(tripDatesQuery(dates).replace(/^\?/, ""));
  query.set("place", place);
  if (fromPlace) query.set("from", "place");
  return `${listingPath(opens)}?${query}`;
}

// The top-most destination above a place, when the place sits inside one (Santa Fe's Bantayan
// Island): what a trip item's `destination` names. A province above it (Cebu) isn't a
// destination, so it stops there; null for a top-most place itself.
export function islandOf(destinations: AreaCard[], slug: string) {
  const bySlug = new Map(destinations.map((each) => [each.slug, each]));
  const seen = new Set([slug]);
  let top: string | null = null;
  let parent = bySlug.get(slug)?.parent_slug ?? null;
  while (parent && bySlug.has(parent) && !seen.has(parent)) {
    seen.add(parent);
    top = parent;
    parent = bySlug.get(parent)?.parent_slug ?? null;
  }
  return top;
}

// The listed places this one sits in, top-most first (an island over its town): its breadcrumbs.
export function ancestorsOf(destinations: AreaCard[], slug: string): AreaCard[] {
  const bySlug = new Map(destinations.map((each) => [each.slug, each]));
  const seen = new Set([slug]);
  const trail: AreaCard[] = [];
  let parent = bySlug.get(slug)?.parent_slug ?? null;
  while (parent && bySlug.has(parent) && !seen.has(parent)) {
    seen.add(parent);
    trail.unshift(bySlug.get(parent)!);
    parent = bySlug.get(parent)?.parent_slug ?? null;
  }
  return trail;
}

// Every listed place inside this one, however deep.
export function descendants(destinations: AreaCard[], slug: string, seen = new Set([slug])): AreaCard[] {
  return destinations
    .filter((child) => child.parent_slug === slug && !seen.has(child.slug))
    .flatMap((child) => {
      seen.add(child.slug);
      return [child, ...descendants(destinations, child.slug, seen)];
    });
}
