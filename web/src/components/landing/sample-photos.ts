// Stand-in photos (Sky & Forest, RAA-102) until destinations and activities have photos of
// their own in the API: free Unsplash shots in public/images/samples/, not the places or
// listings themselves, which the alt text says.

type Photo = { src: string; alt: string };

const COTTAGES: Photo = { src: "/images/samples/cottages.jpg", alt: "Sample photo: bamboo cottages under coconut trees" };

// The first leads the home page's destinations on its widest card, so it is a landscape one;
// the portrait island suits the tall card beside it. The boat is island hopping's, further down
// the same page, so it comes last here rather than leading.
const DESTINATION_PHOTOS: Photo[] = [
  COTTAGES,
  { src: "/images/samples/island.jpg", alt: "Sample photo: a green island in clear water" },
  { src: "/images/samples/snorkeling.jpg", alt: "Sample photo: snorkelling in clear blue water" },
  { src: "/images/samples/wooden-boat.jpg", alt: "Sample photo: a boat on the water at sunset" },
];

const SCOOTERS: Photo = { src: "/images/samples/scooters.jpg", alt: "Sample photo: scooters parked by the road" };

// A city gets a street rather than a beach, so Cebu City's card doesn't show a sandbar.
const PHOTOS_BY_KIND: Record<string, Photo[]> = { city: [SCOOTERS] };

// By tag slug, for the activities the seed data has.
const ACTIVITY_PHOTOS: Record<string, Photo> = {
  // Bantayan is flat, so not the mountain-top view: a low green island, as the area's own.
  sightseeing: { src: "/images/samples/island.jpg", alt: "Sample photo: a green island in clear water" },
  snorkelling: { src: "/images/samples/snorkeling.jpg", alt: "Sample photo: snorkelling in clear blue water" },
  "island-hopping": { src: "/images/samples/wooden-boat.jpg", alt: "Sample photo: a boat on the water at sunset" },
  photography: { src: "/images/samples/photography.jpg", alt: "Sample photo: a man in the sea holding a camera" },
  swimming: { src: "/images/samples/swimming.jpg", alt: "Sample photo: swimming in blue water" },
  freediving: { src: "/images/samples/freediver.jpg", alt: "Sample photo: a freediver in blue water" },
  "sunset-viewing": { src: "/images/samples/sunset.jpg", alt: "Sample photo: palm trees by the water at golden hour" },
  "cliff-diving": { src: "/images/samples/cliff-diving.jpg", alt: "Sample photo: a person jumping off a cliff into the sea" },
};

// The nth destination's photo, from those that suit its kind (an island, a city) when given;
// they repeat in turn.
export function destinationPhoto(index: number, kind?: string): Photo {
  const photos = (kind && PHOTOS_BY_KIND[kind]) || DESTINATION_PHOTOS;
  return photos[index % photos.length];
}

// A destination's photo by its slug, so its page and its card agree wherever it is listed.
export function areaPhoto(slug: string, kind?: string): Photo {
  const hash = [...slug].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return destinationPhoto(hash, kind);
}

// An activity's photo, or else one of the destination photos in turn.
export function activityPhoto(slug: string, index: number): Photo {
  return ACTIVITY_PHOTOS[slug] ?? destinationPhoto(index);
}

// By listing category name, as the API sends it.
const CATEGORY_PHOTOS: Record<string, Photo> = {
  Tour: ACTIVITY_PHOTOS["island-hopping"],
  "Hotel or cottage": COTTAGES,
  "Cottage or bungalow": COTTAGES,
  Motorcycle: SCOOTERS,
  "Snorkel gear": ACTIVITY_PHOTOS.snorkelling,
  Camera: ACTIVITY_PHOTOS.photography,
  "Action camera": ACTIVITY_PHOTOS.photography,
};

// A listing's photo by its category, or else one of the destination photos in turn.
export function listingPhoto(category: string, index: number): Photo {
  return CATEGORY_PHOTOS[category] ?? destinationPhoto(index);
}

// A listing card's photo: its own cover from the API (RAA-109), or else the stand-in.
export function listingCover(
  listing: { title: string; category: string; cover_photo_url: string | null },
  index: number,
): Photo {
  return listing.cover_photo_url ? { src: listing.cover_photo_url, alt: listing.title } : listingPhoto(listing.category, index);
}

// A listing's own photos are already sized by the API and served from storage (RAA-106), so
// next/image passes them through rather than optimising them again; the stand-ins are local.
export function isApiPhoto(src: string) {
  return /^https?:\/\//.test(src);
}

// A stand-in is a scene a place of that kind could look like, never one it can't: a sandbar
// may show clear water, but a church or a park gets no photo rather than a snorkeller.
const ISLAND = DESTINATION_PHOTOS[1];
const LANDMARK_PHOTOS: Record<string, Photo> = {
  ...Object.fromEntries(
    ["cliff-diving", "freediving", "island-hopping", "snorkelling", "swimming", "sunset-viewing"].map((slug) => [
      slug,
      ACTIVITY_PHOTOS[slug],
    ]),
  ),
  sandbar: ISLAND,
  "white-sand": ISLAND,
};

// The places to see on one page, each with the first of its tags whose scene no place before
// it has taken, so two places never share a photo; a place with none left gets none (its card
// shows its icon). `taken` are photos already on the page (its banner's), which none reuses.
export function landmarkPhotos(landmarks: { tags: { slug: string }[] }[], taken: string[] = []): (Photo | null)[] {
  const used = new Set(taken);
  return landmarks.map(({ tags }) => {
    const photo = tags.map((tag) => LANDMARK_PHOTOS[tag.slug]).find((p) => p && !used.has(p.src)) ?? null;
    if (photo) used.add(photo.src);
    return photo;
  });
}

// The photo behind the home page's closing band (RAA-130), under its forest tint.
export const BAND_PHOTO = "/images/samples/island.jpg";
