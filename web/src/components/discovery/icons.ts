// Emoji for tags and areas until there are photos. Keyed by slug; anything new falls back.
const TAG_ICONS: Record<string, string> = {
  swimming: "🏊",
  snorkelling: "🤿",
  "island-hopping": "⛵",
  "cliff-diving": "🪂",
  freediving: "🐠",
  sightseeing: "🧭",
  hiking: "🥾",
  photography: "📸",
  biking: "🚲",
  "sunset-viewing": "🌅",
  "white-sand": "🏖️",
  sandbar: "🏝️",
  "cave-pool": "🕳️",
  viewpoint: "🔭",
  "flower-garden": "🌸",
  history: "🏛️",
  religious: "⛪",
  architecture: "🏰",
  culture: "🎭",
};

const AREA_ICONS: Record<string, string> = {
  island: "🏝️",
  city: "🏙️",
  town: "🏘️",
  province: "🗺️",
  region: "🗺️",
};

export function tagIcon(slug: string): string {
  return TAG_ICONS[slug] ?? "✨";
}

export function areaIcon(kind: string): string {
  return AREA_ICONS[kind] ?? "📍";
}

// Listing categories, keyed by name (the API sends the name, not the slug), so a list of
// things to book doesn't show one ticket icon on every row.
const CATEGORY_ICONS: Record<string, string> = {
  Tour: "⛵",
  Photographer: "📸",
  "Hotel or cottage": "🛖",
  Motorcycle: "🏍️",
  Bicycle: "🚲",
  "E-trike": "🛺",
  "Action camera": "🎥",
  Camera: "📷",
  "Snorkel gear": "🤿",
  "Van transfer": "🚐",
};

export function categoryIcon(name: string): string {
  return CATEGORY_ICONS[name] ?? "🎟️";
}
