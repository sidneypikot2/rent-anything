import type { AreaDetail } from "@/api/discovery";
import type { GettingHere } from "@/components/landing/launch-area";
import { kmText } from "@/components/plan/plan-data";
import { distanceKm, type LatLng } from "@/lib/geo";

// What an area page says to get to know the place (RAA-252), worked out from the area response
// alone: nothing here is written per place, so every destination gets its page from its data,
// and a part with nothing to go on is left out rather than shown empty.

type Landmark = AreaDetail["landmarks"][number];
type Listing = AreaDetail["listings"][number];
type Place = AreaDetail["areas"][number];

// Two places to see this close (km) share a day of the sample plan.
const SAME_DAY_KM = 6;
const SAMPLE_DAYS = 3;

// Plan a whole trip, opened on this place: `where` must be a top-level destination (the plan's
// places), so a town's page plans its island. The page's dates and guests go along.
export function planHref(where: string, datesQuery: string) {
  const params = new URLSearchParams([["where", where], ...new URLSearchParams(datesQuery)]);
  return `/plan?${params}`;
}

// A link to this page's What to book on one group (`show`), keeping the page's dates and guests.
export function showHref(slug: string, show: string, datesQuery: string) {
  const params = new URLSearchParams([...new URLSearchParams(datesQuery), ["show", show]]);
  return `/${slug}?${params}#listings`;
}

export function countText(count: number, noun: string, plural = `${noun}s`) {
  return `${count} ${count === 1 ? noun : plural}`;
}

// How a traveller reaches the place: the team's text, else the hand-written route.
export function gettingHereText(guide: AreaDetail["guide"], route: GettingHere | undefined) {
  if (guide.getting_there) return guide.getting_there;
  return route ? `${route.route}. ${route.note}` : null;
}

// The businesses offering each group here (What to book's cards are one per business).
export function businessesIn(listings: Listing[], group: Listing["group"]) {
  return new Set(listings.filter((listing) => listing.group === group).map((listing) => listing.business.id)).size;
}

// The places inside this one with stays, most first, each with the place to see nearest to it.
export function stayPlaces(places: Place[], landmarks: Landmark[]) {
  return places
    .filter((place) => place.stay_count > 0)
    .sort((a, b) => b.stay_count - a.stay_count || a.name.localeCompare(b.name))
    .map((place) => {
      const nearest = nearestTo(place.center, landmarks);
      return {
        place,
        near: nearest ? { name: nearest.landmark.name, distance: kmText(nearest.km) } : null,
      };
    });
}

function nearestTo(point: LatLng, landmarks: Landmark[]) {
  return landmarks
    .map((landmark) => ({ landmark, km: distanceKm(point, landmark.location) }))
    .sort((a, b) => a.km - b.km)[0];
}

export type SampleDay = { title: string; plan: string; book: string[] };

// A sample few days: the places tours go to most, nearby ones sharing a day, and what to book for
// each (the tours that go there; a transfer and a stay on the first). Under two places to see
// there is no plan to suggest. `landmarks` comes most visited first.
export function sampleDays(landmarks: Landmark[], listings: Listing[]): SampleDay[] {
  if (landmarks.length < 2) return [];
  const byId = new Map(listings.map((listing) => [listing.id, listing]));
  const offered = new Set(listings.map((listing) => listing.group));
  const left = [...landmarks];
  const days: Landmark[][] = [];
  while (left.length > 0 && days.length < SAMPLE_DAYS) {
    const [first] = left.splice(0, 1);
    const nearIndex = left.findIndex((other) => distanceKm(first.location, other.location) <= SAME_DAY_KM);
    days.push(nearIndex < 0 ? [first] : [first, ...left.splice(nearIndex, 1)]);
  }
  return days.map((stops, index) => {
    const names = stops.map((stop) => stop.name);
    const tours = [
      ...new Set(
        stops.flatMap((stop) => stop.visited_by.flatMap((id) => {
          const listing = byId.get(id);
          return listing ? [listing.category] : [];
        })),
      ),
    ];
    const book = [
      ...(index === 0 && offered.has("transfer") ? ["Transfer"] : []),
      ...(index === 0 && offered.has("stay") ? ["Stay"] : []),
      ...tours,
    ];
    // Somewhere with no tour going: on your own, by a rented ride when there is one.
    if (tours.length === 0 && offered.has("rental")) book.push("Rental to get there");
    const apart = stops.length > 1 ? ` (${kmText(distanceKm(stops[0].location, stops[1].location))} apart)` : "";
    return {
      title: index === 0 ? `Arrive, then ${names[0]}` : names.join(" and "),
      plan: index === 0 && stops.length === 1
        ? `Get in, settle into your stay and head to ${names[0]}.`
        : `${names.join(", then ")}${apart}.`,
      book,
    };
  });
}

export type Question = { question: string; answer: string };

// The questions guests ask about a place, answered from what the page knows; a question with no
// answer here is left out.
export function questionsAbout({
  name,
  guide,
  gettingHere,
  stays,
  ownStays,
  rentals,
  transfers,
  landmarks,
  tours,
}: {
  name: string;
  guide: AreaDetail["guide"];
  gettingHere: string | null;
  stays: ReturnType<typeof stayPlaces>;
  ownStays: number;
  rentals: number;
  transfers: number;
  landmarks: Landmark[];
  tours: number;
}): Question[] {
  const where = stays.slice(0, 3).map(({ place }) => `${place.name} (${countText(place.stay_count, "stay")})`);
  const around = [
    rentals > 0 && `rent a scooter, car or bike from ${countText(rentals, "local partner")}`,
    transfers > 0 && `book a transfer from ${countText(transfers, "partner")}`,
  ].filter((part) => part !== false);
  const sights = landmarks.slice(0, 4).map((landmark) => landmark.name);
  const questions: (Question | false)[] = [
    !!gettingHere && { question: `How do I get to ${name}?`, answer: gettingHere },
    !!guide.best_time_to_visit && { question: `When is the best time to visit ${name}?`, answer: guide.best_time_to_visit },
    where.length > 0
      ? { question: `Where should I stay in ${name}?`, answer: `Most stays are in ${listText(where)}.` }
      : ownStays > 0 && { question: `Where should I stay in ${name}?`, answer: `There are ${countText(ownStays, "stay")} to book here.` },
    around.length > 0 && { question: `How do I get around ${name}?`, answer: `${capitalize(listText(around))}.` },
    sights.length > 0 && {
      question: `What is there to do in ${name}?`,
      answer: `See ${listText(sights)}${tours > 0 ? `, with ${countText(tours, "tour or activity", "tours and activities")} to book` : ""}.`,
    },
  ];
  return questions.filter((question) => question !== false);
}

function listText(parts: string[]) {
  return parts.length < 2 ? (parts[0] ?? "") : `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
