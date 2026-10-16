// Line icons (Sky & Forest, RAA-102): 24px grid, 1.8 stroke, round caps, drawn in
// currentColor. Activity tags by slug, area kinds, and listing categories by name (the API
// sends the name); anything without its own icon gets the map pin or the ticket.

const circle = (cx: number, cy: number, r: number) =>
  `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
const WAVES = (y: number) => `M3 ${y}c2 1.5 4 1.5 6 0s4-1.5 6 0 4 1.5 6 0`;

const PIN = ["M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11Z", circle(12, 10, 2.5)];
const TICKET = ["M3 7h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4Z", "M14 7v10"];
const SAILBOAT = ["M12 3v13", "M12 5l6 9h-6", "M12 8l-5 6h5", WAVES(19)];
const CAMERA = ["M4 8h3l2-3h6l2 3h3v11H4Z", circle(12, 13, 3.5)];
const SNORKEL = [
  "M6 8h9a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-2l-1.5-2h-2L8 14H6a2 2 0 0 1-2-2v-2a2 2 0 0 1 2-2Z",
  "M20 4v11a4 4 0 0 1-4 4h-3",
];
const BICYCLE = [circle(6, 16, 3.5), circle(18, 16, 3.5), "M6 16l4-7h5l3 7", "M10 9l2 7", "M13 6h3"];
const HUT = ["M3 11l9-7 9 7", "M5 10v10h14V10", "M10 20v-5h4v5"];

const TAGS: Record<string, string[]> = {
  sightseeing: [circle(12, 12, 9), "M15.5 8.5l-2 5-5 2 2-5Z"],
  snorkelling: SNORKEL,
  "island-hopping": SAILBOAT,
  "cliff-diving": ["M3 21V8h4l2 13", "M16 3v9", "M13 9l3 3 3-3", "M11 18c1.7 1.2 3.3 1.2 5 0s3.3-1.2 5 0"],
  freediving: ["M3 12c3-4 8-5 12-2l5-3v10l-5-3c-4 3-9 2-12-2Z", circle(8, 11, 0.6)],
  swimming: [circle(16, 6, 2), "M5 12l4-3 4 3", WAVES(16), WAVES(20)],
  hiking: ["M3 20l6-11 4 6 2-3 6 8Z"],
  photography: CAMERA,
  biking: BICYCLE,
  "sunset-viewing": ["M7 15a5 5 0 0 1 10 0", "M3 15h18", "M12 6v2", "M5.6 8.6l1.4 1.4", "M18.4 8.6L17 10", "M7 19h10"],
  "white-sand": ["M12 4a8 8 0 0 1 8 8H4a8 8 0 0 1 8-8Z", "M12 12v8", "M5 20h14"],
  sandbar: ["M3 15c4-3 14-3 18 0", WAVES(19)],
  "cave-pool": ["M4 20v-8a8 8 0 0 1 16 0v8", "M8 18c1.3-1 2.7-1 4 0s2.7 1 4 0"],
  viewpoint: [circle(7, 15, 3.5), circle(17, 15, 3.5), "M5 12V6h4v6", "M19 12V6h-4v6", "M10.5 13h3"],
  "flower-garden": ["M8 5l2 2 2-3 2 3 2-2v4a4 4 0 0 1-8 0Z", "M12 13v8", "M12 18c-2 0-3.5-1-4-3"],
  history: ["M4 9h16l-8-5Z", "M5 20h14", "M7 11v7", "M12 11v7", "M17 11v7"],
  religious: ["M12 3v4", "M10 5h4", "M6 21V11l6-4 6 4v10", "M10 21v-4h4v4"],
  architecture: ["M4 21V8l8-4 8 4v13", "M9 21v-6h6v6", "M3 21h18"],
  culture: ["M5 5h14v6a7 7 0 0 1-14 0Z", "M9 10h1", "M14 10h1", "M9 14c1.5 1.5 4.5 1.5 6 0"],
};

const MAP = ["M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2Z", "M9 4v14", "M15 6v14"];
const AREAS: Record<string, string[]> = {
  island: ["M12 20v-8", "M12 12c-1-4-5-5-8-3 3 0 5 1 8 3", "M12 12c1-4 5-5 8-3-3 0-5 1-8 3", "M12 12c-2-3-1-6 1-8", WAVES(20)],
  city: ["M4 21V9h6v12", "M10 21V4h7v17", "M17 21v-8h3v8", "M3 21h18"],
  town: ["M3 21v-9l5-4 5 4v9", "M13 21v-6l4-3 4 3v6", "M2 21h20"],
  province: MAP,
  region: MAP,
};

const CATEGORIES: Record<string, string[]> = {
  Tour: SAILBOAT,
  Camera: CAMERA,
  "Hotel or cottage": HUT,
  Motorcycle: [circle(5, 17, 3), circle(19, 17, 3), "M5 17l4-6h5l3 6", "M12 11l-1-4h3", "M14 11h4"],
  "Action camera": ["M4 8h11v9H4Z", "M15 11l5-2v7l-5-2", circle(9.5, 12.5, 2)],
  "Snorkel gear": SNORKEL,
  "Van transfer": ["M3 16V8a2 2 0 0 1 2-2h10l5 5v5Z", "M3 11h17", circle(7, 17, 2), circle(17, 17, 2)],
};

function Glyph({ paths, className }: { paths: string[]; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

type Props = { className?: string };

export function TagGlyph({ slug, className }: { slug: string } & Props) {
  return <Glyph paths={TAGS[slug] ?? PIN} className={className} />;
}

export function AreaGlyph({ kind, className }: { kind?: string | null } & Props) {
  return <Glyph paths={(kind && AREAS[kind]) || PIN} className={className} />;
}

export function CategoryGlyph({ name, className }: { name: string } & Props) {
  return <Glyph paths={CATEGORIES[name] ?? TICKET} className={className} />;
}

// A landmark: the map pin.
export function PlaceGlyph({ className }: Props) {
  return <Glyph paths={PIN} className={className} />;
}

// A tick in a circle: a trust point.
export function CheckGlyph({ className }: Props) {
  return <Glyph paths={[circle(12, 12, 9), "M8 12.5l2.5 2.5L16 9.5"]} className={className} />;
}

// Controls: a plain tick (a step done), arrows (a wizard's Back and Next) and a cross (closing).
export function TickGlyph({ className }: Props) {
  return <Glyph paths={["M5 12.5l4.5 4.5L19 7.5"]} className={className} />;
}

export function ArrowGlyph({ direction = "right", className }: { direction?: "left" | "right" } & Props) {
  return <Glyph paths={direction === "right" ? ["M5 12h14", "M13 6l6 6-6 6"] : ["M19 12H5", "M11 6l-6 6 6 6"]} className={className} />;
}

// A magnifier: search, where a button has no room for its word.
export function SearchGlyph({ className }: Props) {
  return <Glyph paths={[circle(11, 11, 6.5), "M20 20l-4.4-4.4"]} className={className} />;
}

export function CloseGlyph({ className }: Props) {
  return <Glyph paths={["M6 6l12 12", "M18 6L6 18"]} className={className} />;
}

// The hero search's When and Guests: a calendar page and two people.
export function CalendarGlyph({ className }: Props) {
  return <Glyph paths={["M4 6h16v14H4Z", "M4 10h16", "M8 3v4", "M16 3v4"]} className={className} />;
}

export function GuestsGlyph({ className }: Props) {
  return (
    <Glyph
      paths={[circle(9, 8, 3.5), "M3 20a6 6 0 0 1 12 0", "M15.5 4.8a3.5 3.5 0 0 1 0 6.4", "M18 14.5a6 6 0 0 1 3 5.5"]}
      className={className}
    />
  );
}

// A plus: adding something (Add to trip).
export function PlusGlyph({ className }: Props) {
  return <Glyph paths={["M12 5v14", "M5 12h14"]} className={className} />;
}

// What a listing includes (RAA-125), for the chips on its row: listingFeatures names them.
const FEATURES: Record<string, string[]> = {
  guide: [circle(9, 7, 3), "M3.5 20a5.5 5.5 0 0 1 11 0", "M17 4v16", "M17 4l4 2.5-4 2.5"],
  seats: ["M7 4h6v9H7Z", "M5 13h12l1 4H5Z", "M7 17v3", "M16 17v3"],
  luggage: ["M6 8h12v12H6Z", "M9 8V5h6v3", "M10 12v4", "M14 12v4"],
  route: [circle(6, 18, 2), circle(18, 6, 2), "M8 18h6a3 3 0 0 0 0-6h-4a3 3 0 0 1 0-6h6"],
  sizes: ["M3 15 15 3l6 6L9 21Z", "M7 11l2 2", "M10 8l2 2", "M13 5l2 2"],
  accessory: ["M4 8h11v9H4Z", "M15 11l5-2v7l-5-2"],
  engine: [circle(12, 13, 7), "M12 13l3-3", "M9 4h6"],
  helmet: ["M3.5 15a8.5 8.5 0 0 1 17 0v2h-17Z", "M12 6.5v4", "M3.5 17l1.5 3h14l1.5-3"],
  guests: [circle(9, 8, 3.5), "M3 20a6 6 0 0 1 12 0", "M15.5 4.8a3.5 3.5 0 0 1 0 6.4", "M18 14.5a6 6 0 0 1 3 5.5"],
  bed: ["M3 18V7", "M3 14h18v4", "M21 14v-2a3 3 0 0 0-3-3h-7v5", circle(7, 11, 1.8)],
  bathroom: ["M4 21V7a4 4 0 0 1 8 0", "M9 9h6l-1-2h-4Z", "M10 12v1", "M14 12v1", "M12 15v1"],
  amenity: ["M5 12.5l4.5 4.5L19 7.5"],
  wifi: ["M2.5 9a14 14 0 0 1 19 0", "M5.5 12.5a9.5 9.5 0 0 1 13 0", "M8.5 16a5 5 0 0 1 7 0", "M12 19h.01"],
  breakfast: ["M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5Z", "M17 10h1.5a2.5 2.5 0 0 1 0 5H17", "M8 3.5V6", "M12 3.5V6"],
  cancellation: ["M12 3 5 6v5c0 4.5 3 8.3 7 10 4-1.7 7-5.5 7-10V6Z", "M9 12l2 2 4-4"],
};

export function FeatureGlyph({ name, className }: { name: string } & Props) {
  return <Glyph paths={FEATURES[name] ?? FEATURES.amenity} className={className} />;
}

// Four squares: everything, the "All" filter.
export function GridGlyph({ className }: Props) {
  return (
    <Glyph
      paths={["M4 4h7v7H4Z", "M13 4h7v7h-7Z", "M4 13h7v7H4Z", "M13 13h7v7h-7Z"]}
      className={className}
    />
  );
}

// Three sliders: a section's filters (RAA-126).
export function FilterGlyph({ className }: Props) {
  return (
    <Glyph
      paths={["M4 6h9", "M17 6h3", "M4 12h3", "M11 12h9", "M4 18h11", "M19 18h1", circle(15, 6, 2), circle(9, 12, 2), circle(17, 18, 2)]}
      className={className}
    />
  );
}

// An i in a circle: a card's details (RAA-126).
export function InfoGlyph({ className }: Props) {
  return <Glyph paths={[circle(12, 12, 9), "M12 11v5", "M12 8h.01"]} className={className} />;
}
