import { STAY_LABELS } from "@/components/listings/stay-labels";

// What a listing includes and how big it is, as the chips on its row (RAA-125), from the
// guest-safe details the area API sends (RAA-124). Each chip names its FeatureGlyph. Only what
// the details actually say: a key a listing doesn't have gives no chip.
export type Feature = { icon: string; label: string; trust?: boolean };

type Details = Record<string, unknown>;

const CANCELLATION: Record<string, string> = {
  free_cancellation: "Free cancellation",
  seven_days: "Free cancellation up to 7 days",
  fourteen_days: "Free cancellation up to 14 days",
};

// The amenities worth a chip of their own icon; the rest share the plain tick.
const AMENITY_ICONS: Record<string, string> = { wifi: "wifi", breakfast_included: "breakfast" };

export function listingFeatures(listing: { details: Details; cancellation_policy: string }): Feature[] {
  const d = listing.details;
  const features: Feature[] = [];
  const add = (icon: string, label: string | number | false | null | undefined) => {
    if (typeof label === "string" && label) features.push({ icon, label });
  };
  const list = (value: unknown) => (Array.isArray(value) ? value.map(String).filter(Boolean) : []);
  const count = (value: unknown) => (typeof value === "number" && value > 0 ? value : null);

  add("guide", d.guide_included === true && "Guide included");
  const seats = count(d.seats);
  add("seats", seats && `${seats} seats`);
  const luggage = count(d.luggage);
  add("luggage", luggage && `${luggage} bags`);
  add("route", typeof d.route === "string" && d.route);
  const sizes = list(d.sizes);
  add("sizes", sizes.length > 0 && `Sizes ${sizes.join(", ")}`);
  for (const item of [...list(d.accessories), ...list(d.lenses)]) add("accessory", capitalise(item));
  const engine = count(d.engine_cc);
  add("engine", engine && `${engine} cc`);
  add("helmet", d.helmet_included === true && "Helmets included");
  const guests = count(d.guests);
  add("guests", guests && `Sleeps ${guests}`);
  add("bed", beds(d.rooms));
  add("bathroom", typeof d.bathroom === "string" && STAY_LABELS[d.bathroom]);
  for (const amenity of list(d.amenities)) add(AMENITY_ICONS[amenity] ?? "amenity", STAY_LABELS[amenity] ?? amenity);

  const cancellation = CANCELLATION[listing.cancellation_policy];
  if (cancellation) features.push({ icon: "cancellation", label: cancellation, trust: true });
  return features;
}

// "1 double bed", "2 beds" across rooms.
function beds(rooms: unknown) {
  if (!Array.isArray(rooms)) return null;
  const all = rooms.flatMap((room: { beds?: { type?: string; count?: number }[] }) => room?.beds ?? []);
  const total = all.reduce((sum, bed) => sum + (bed.count ?? 0), 0);
  if (total === 0) return null;
  if (all.length === 1) {
    const name = (STAY_LABELS[all[0].type ?? ""] ?? "bed").toLowerCase();
    return `${total} ${total === 1 ? name : name.replace(/bed$/, "beds")}`;
  }
  return `${total} beds`;
}

function capitalise(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
