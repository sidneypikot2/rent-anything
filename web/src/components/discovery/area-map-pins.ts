import type { Explore } from "@/api/discovery";
import { landmarkPhoto, listingCover } from "@/components/landing/sample-photos";
import { formatPeso } from "@/lib/money";
import { priceUnitText } from "@/lib/pricing";
import type { Feature } from "./listing-features";

type Photo = { src: string; alt: string };

// What a listing row or a place card already knows, for the side panel a pin opens, with the
// photo it shows, so a pin's pop-up matches its card.
export type ListingPanelInfo = { by: string; summary: string | null; features: Feature[]; photo: Photo };
export type LandmarkInfo = { description: string; tags: { slug: string; name: string }[]; photo: Photo };

// A pin on an area page's map, built on the server from the explore response and again in the
// browser from a distance search, so both sides draw it the same.
export type ListingPin = {
  key: string;
  kind: "listing";
  id: number;
  title: string;
  category: string;
  bookingType: string;
  // Booked at once, without asking the partner (RAA-133): the pop-up's pill.
  instantBook: boolean;
  // "₱1,500" and "/ night": the pin shows the amount, the pop-up both.
  price: { amount: string; unit?: string } | null;
  lat: number;
  lng: number;
  photo: Photo;
  info?: ListingPanelInfo;
};
export type PlacePin = {
  key: string;
  kind: "place";
  slug: string;
  title: string;
  areaSlug: string;
  lat: number;
  lng: number;
  photo: Photo;
  landmark?: LandmarkInfo;
};
export type AreaPin = ListingPin | PlacePin;

export function listingPin(listing: Explore["listings"][number], index: number, info?: ListingPanelInfo): ListingPin {
  return {
    key: listingKey(listing.id),
    kind: "listing",
    id: listing.id,
    title: listing.title,
    category: listing.category,
    bookingType: listing.booking_type,
    instantBook: listing.instant_book,
    price: listing.price_from_cents
      ? { amount: formatPeso(listing.price_from_cents), unit: priceUnitText(listing.price_unit) }
      : null,
    lat: listing.location.lat,
    lng: listing.location.lng,
    photo: info?.photo ?? listingCover(listing, index),
    info,
  };
}

// A pin's key, shared by the map and the card or row it stands for.
export const listingKey = (id: number) => `listing-${id}`;
export const placeKey = (slug: string) => `place-${slug}`;

// Landmarks only: areas have their own pages, not pins.
export function placePins(destinations: Explore["destinations"], landmarks: Map<string, LandmarkInfo>): PlacePin[] {
  return destinations
    .filter((place) => place.type === "landmark")
    .map((place, index) => {
      const landmark = landmarks.get(place.slug);
      return {
        key: placeKey(place.slug),
        kind: "place",
        slug: place.slug,
        title: place.name,
        areaSlug: place.area_slug,
        lat: place.location.lat,
        lng: place.location.lng,
        photo: landmark?.photo ?? landmarkPhoto([], index),
        landmark,
      };
    });
}
