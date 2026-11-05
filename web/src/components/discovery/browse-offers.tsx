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
// What to book search matches, and `vehicle` what Getting around's filters ask of it (RAA-205).
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
    href: `/listings/${listing.id}${tripDatesQuery(dates)}`,
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
    vehicle: listing.handover
      ? {
          kind: listing.category,
          transmission: typeof listing.details?.transmission === "string" ? listing.details.transmission : null,
          delivery: listing.handover.delivery_fee_cents !== null,
          returnPickup: listing.handover.return_pickup_fee_cents !== null,
          childHelmets: listing.handover.child_helmet_fee_cents !== null,
        }
      : undefined,
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
    panelAction: <AddToTripButton key={`panel-add-${listing.id}`} listing={listing} dates={dates} preview={preview} />,
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

// Listings by their business, each business where its first listing is, the order kept.
export function byBusiness<T extends { business: { id: number } }>(rows: T[]): T[][] {
  const groups = new Map<number, T[]>();
  for (const row of rows) groups.set(row.business.id, [...(groups.get(row.business.id) ?? []), row]);
  return [...groups.values()];
}

// A business's own page, with the trip's dates and guests, opening on the group the guest came
// from (`show`, a What to book group's id); `place` is the place's page it was opened on, which
// its way back returns to.
export function businessHref(id: number, dates: TripDates, show?: string, place?: string) {
  const query = new URLSearchParams(tripDatesQuery(dates).replace(/^\?/, ""));
  if (show) query.set("show", show);
  if (place) query.set("place", place);
  const search = query.toString();
  return `/businesses/${id}${search ? `?${search}` : ""}`;
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

// Every listed place inside this one, however deep.
export function descendants(destinations: AreaCard[], slug: string, seen = new Set([slug])): AreaCard[] {
  return destinations
    .filter((child) => child.parent_slug === slug && !seen.has(child.slug))
    .flatMap((child) => {
      seen.add(child.slug);
      return [child, ...descendants(destinations, child.slug, seen)];
    });
}
