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
