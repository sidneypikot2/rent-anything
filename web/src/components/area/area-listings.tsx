import { getBookCards, type AreaDetail, type BookCardsPage, type Explore } from "@/api/discovery";
import { countText } from "@/components/area/area-guide";
import {
  listingPin,
  placePins,
  type LandmarkInfo,
  type ListingPanelInfo,
} from "@/components/discovery/area-map-pins";
import { FIRST_ROWS, firstQuery, PER_PAGE, type BookQuery } from "@/components/discovery/book-query";
import { byCard, listingByLine, listingChips, listingPhotos } from "@/components/discovery/browse-offers";
import { TRIP_ORDER_GROUPS } from "@/components/discovery/categories";
import { ListingBrowser, type BookSection } from "@/components/discovery/listing-browser";
import { BOOKING_STATE, GETTING_HERE } from "@/components/landing/launch-area";
import { landmarkPhotos } from "@/components/landing/sample-photos";
import { addPreview } from "@/components/trips/add-preview";
import type { TripDates } from "@/components/trips/trip-dates";
import { Section } from "@/components/ui/section";

// What a place's page and its What to book page (`/<area>/book`) build alike from the area
// response: the listings grouped by trip need, and the map's pins.

type Listing = AreaDetail["listings"][number];
type Landmark = AreaDetail["landmarks"][number];

// Listings grouped by what the trip needs (SPEC: the area home groups by trip need), which
// What to book's filter offers (RAA-125), in TRIP_ORDER_GROUPS' order (a group the trip already has here moves to the end).
// Each group has its anchor and an icon for the sidebar. One card per listing title per business
// ("Mio 125 by …"), or for a stay per business, with its listings in this group (byCard); those
// with a price first, so a section opens on what can be compared.
export function tripNeeds(listings: Listing[]) {
  return TRIP_ORDER_GROUPS.map(({ group, id, title, icon, need }) => ({
    title,
    id,
    icon,
    need,
    group: group satisfies Listing["group"],
    cards: byCard(
      listings
        .filter((listing) => listing.group === group)
        .sort((a, b) => Number(!a.price_from_cents) - Number(!b.price_from_cents)),
    ),
  })).filter((need) => need.cards.length > 0);
}

export type TripNeed = ReturnType<typeof tripNeeds>[number];

// The places to see, the ones most tours go to first: they are the ones a trip can reach.
export function placesToSee(detail: AreaDetail) {
  return [...detail.landmarks].sort((a, b) => b.visited_by.length - a.visited_by.length);
}

// The map's pins and what a place to see's card shows, reusing what the rows and cards show, so
// a pin's pop-up and panel match. `bannerPhoto` keeps a place to see's stand-in off the banner's.
export function areaMapData({
  detail,
  explore,
  needs,
  slug,
  dates,
  datesQuery,
  bannerPhoto,
}: {
  detail: AreaDetail;
  explore: Explore | null;
  needs: TripNeed[];
  slug: string;
  dates: TripDates;
  datesQuery: string;
  bannerPhoto: string;
}) {
  const { area, listings } = detail;
  const landmarks = placesToSee(detail);
  const byLine = (listing: Listing) => listingByLine(listing, slug);
  // A place to see's photo: its own first one (RAA-211), else a stand-in that fits it, never one
  // another place or the banner has (landmarkPhotos).
  const photos = landmarkPhotos(landmarks, [bannerPhoto]);
  // The rows that visit each place to see, on the What to book page.
  const listingById = new Map(listings.map((listing) => [listing.id, listing]));
  const visitsOf = (landmark: Landmark) =>
    landmark.visited_by.flatMap((id) => {
      const listing = listingById.get(id);
      return listing
        ? [{ id, title: listing.title, href: `/listings/${id}${datesQuery}`, category: listing.category }]
        : [];
    });
  const rowInfo = new Map<number, ListingPanelInfo>(
    needs.flatMap((need) =>
      need.cards.flat().map((listing) => [
        listing.id,
        {
          by: byLine(listing),
          place: listing.area_name,
          summary: listing.summary,
          features: listingChips(listing),
          photo: listingPhotos(listing)[0] ?? null,
          add: addPreview(listing, byLine(listing)),
        },
      ]),
    ),
  );
  const landmarkInfo = new Map<string, LandmarkInfo>(
    landmarks.map((landmark, index) => [
      landmark.slug,
      { description: landmark.description, tags: landmark.tags, photo: photos[index], visits: visitsOf(landmark) },
    ]),
  );
  const pins = explore
    ? [
        ...explore.listings.map((listing) => listingPin(listing, rowInfo.get(listing.id))),
        ...placePins(explore.destinations, landmarkInfo),
      ]
    : [];
  const map =
    explore && pins.length > 0
      ? {
          pins,
          center: explore.anchor.location,
          dates,
          datesQuery,
          areaName: area.name,
          landmarks: Object.fromEntries(landmarkInfo),
        }
      : null;
  return { landmarks, photos, listingById, visitsOf, byLine, map };
}

// What to book: every card here by trip need, in a sidebar of sections beside rows of white
// cards (ListingBrowser), on its own page since 2026-11-10 (the place's page has the card rows).
export function WhatToBook({
  detail,
  seed,
  slug,
  dates,
  datesQuery,
  show,
  q,
  places,
  island,
}: {
  detail: AreaDetail;
  // The first view's pages, fetched on the server (bookSeed).
  seed: { query: BookQuery; data: BookCardsPage }[];
  slug: string;
  dates: TripDates;
  datesQuery: string;
  show?: string;
  q?: string;
  places: string[];
  island: string | null;
}) {
  const { area, listings } = detail;
  // The intro names the partners the sidebar's cards come from.
  const partners = new Set(listings.map((listing) => listing.business.id)).size;
  return (
    <Section
      id="listings"
      surface="paper"
      title="What to book"
      intro={`From ${countText(partners, "local partner")}: tours, transfers, rentals and stays. Saving to a trip is free; ${BOOKING_STATE.unpaid}.`}
    >
      <ListingBrowser
        slug={slug}
        sections={BOOK_SECTIONS}
        seed={seed}
        dates={dates}
        initial={show}
        query={q}
        placeName={area.name}
        clearHref={`/${slug}/book${datesQuery}`}
        gettingHere={GETTING_HERE[slug]}
        tripPlaces={places}
        tripIsland={island}
        empty={<p className="text-muted">Nothing here yet.</p>}
      />
    </Section>
  );
}

// What to book's sections, in the order the trip's needs come (TRIP_ORDER_GROUPS).
export const BOOK_SECTIONS: BookSection[] = TRIP_ORDER_GROUPS.map(({ group, id, title, icon }) => ({ group, id, title, icon }));

// The pages What to book opens on, fetched on the server for the first paint: `?show=`'s section's
// first page, else every section's first rows (All).
export async function bookSeed(slug: string, show: string | undefined, q: string | undefined) {
  const picked = BOOK_SECTIONS.find((section) => section.id === show);
  const wanted = picked ? [{ section: picked, perPage: PER_PAGE }] : BOOK_SECTIONS.map((section) => ({ section, perPage: FIRST_ROWS }));
  const pages = await Promise.all(
    wanted.map(async ({ section, perPage }) => {
      const data = await getBookCards(slug, section.group, perPage, q);
      return data && { query: firstQuery(section.group, perPage, q), data };
    }),
  );
  return pages.filter((page) => page !== null);
}
