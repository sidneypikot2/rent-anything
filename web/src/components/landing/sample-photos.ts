// Stand-in photos (Sky & Forest, RAA-102) until destinations and activities have photos of
// their own in the API: free Unsplash shots in public/images/samples/, not the places or
// listings themselves, which the alt text says.

type Photo = { src: string; alt: string };

const DESTINATION_PHOTOS: Photo[] = [
  { src: "/images/samples/island.jpg", alt: "Sample photo: a green island in clear water" },
  { src: "/images/samples/wooden-boat.jpg", alt: "Sample photo: a boat on the water at sunset" },
  { src: "/images/samples/snorkeling.jpg", alt: "Sample photo: snorkelling in clear blue water" },
  { src: "/images/samples/cottages.jpg", alt: "Sample photo: bamboo cottages under coconut trees" },
];

// By tag slug, for the activities the seed data has.
const ACTIVITY_PHOTOS: Record<string, Photo> = {
  sightseeing: { src: "/images/samples/viewpoint.jpg", alt: "Sample photo: an island seen from a mountain top" },
  snorkelling: { src: "/images/samples/snorkeling.jpg", alt: "Sample photo: snorkelling in clear blue water" },
  "island-hopping": { src: "/images/samples/wooden-boat.jpg", alt: "Sample photo: a boat on the water at sunset" },
  photography: { src: "/images/samples/photography.jpg", alt: "Sample photo: a man in the sea holding a camera" },
  swimming: { src: "/images/samples/swimming.jpg", alt: "Sample photo: swimming in blue water" },
  freediving: { src: "/images/samples/freediver.jpg", alt: "Sample photo: a freediver in blue water" },
  "sunset-viewing": { src: "/images/samples/sunset.jpg", alt: "Sample photo: palm trees by the water at golden hour" },
  "cliff-diving": { src: "/images/samples/cliff-diving.jpg", alt: "Sample photo: a person jumping off a cliff into the sea" },
};

// The nth destination's photo; they repeat in turn.
export function destinationPhoto(index: number): Photo {
  return DESTINATION_PHOTOS[index % DESTINATION_PHOTOS.length];
}

// An activity's photo, or else one of the destination photos in turn.
export function activityPhoto(slug: string, index: number): Photo {
  return ACTIVITY_PHOTOS[slug] ?? destinationPhoto(index);
}

// The photo behind the How-it-works band.
export const BAND_PHOTO = "/images/samples/cottages.jpg";
