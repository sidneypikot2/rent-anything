// Line icons for activity tags (Sky & Forest, RAA-102): 24px grid, 1.8 stroke, round caps,
// drawn in currentColor, in place of the emoji in icons.ts. Keyed by tag slug; a tag without
// one gets the map pin.

const circle = (cx: number, cy: number, r: number) =>
  `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
const WAVES = (y: number) => `M3 ${y}c2 1.5 4 1.5 6 0s4-1.5 6 0 4 1.5 6 0`;

const GLYPHS: Record<string, string[]> = {
  sightseeing: [circle(12, 12, 9), "M15.5 8.5l-2 5-5 2 2-5Z"],
  snorkelling: [
    "M6 8h9a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-2l-1.5-2h-2L8 14H6a2 2 0 0 1-2-2v-2a2 2 0 0 1 2-2Z",
    "M20 4v11a4 4 0 0 1-4 4h-3",
  ],
  "island-hopping": ["M12 3v13", "M12 5l6 9h-6", "M12 8l-5 6h5", WAVES(19)],
  "cliff-diving": ["M3 21V8h4l2 13", "M16 3v9", "M13 9l3 3 3-3", "M11 18c1.7 1.2 3.3 1.2 5 0s3.3-1.2 5 0"],
  freediving: ["M3 12c3-4 8-5 12-2l5-3v10l-5-3c-4 3-9 2-12-2Z", circle(8, 11, 0.6)],
  swimming: [circle(16, 6, 2), "M5 12l4-3 4 3", WAVES(16), WAVES(20)],
  hiking: ["M3 20l6-11 4 6 2-3 6 8Z"],
  photography: ["M4 8h3l2-3h6l2 3h3v11H4Z", circle(12, 13, 3.5)],
  biking: [circle(6, 16, 3.5), circle(18, 16, 3.5), "M6 16l4-7h5l3 7", "M10 9l2 7", "M13 6h3"],
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

const FALLBACK = ["M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11Z", circle(12, 10, 2.5)];

export function TagGlyph({ slug, className }: { slug: string; className?: string }) {
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
      {(GLYPHS[slug] ?? FALLBACK).map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
