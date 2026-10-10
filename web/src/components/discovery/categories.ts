// The kinds of things partners list, each searched by its category's name (search matches
// listing categories as well as titles). The home hero offers them, and so does a search
// that finds nothing.
export const CATEGORIES = [
  { label: "Tours", query: "Tour" },
  { label: "Motorbikes", query: "Motorcycle" },
  { label: "Stays", query: "Hotel" },
  { label: "Snorkel gear", query: "Snorkel gear" },
  { label: "Transfers", query: "Van transfer" },
];

export const categoryHref = (query: string) => `/search?q=${encodeURIComponent(query)}`;
