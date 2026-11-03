// What an area page says about a place that no data holds yet (RAA-252): its seasons, the steps
// of the way there, what is good to know, a line on each town to stay in, and the questions only
// a person can answer. Written by hand per place for now, as GETTING_HERE is; the area page
// roadmap moves them into the database (climate and gateways at seeding, notes inherited down the
// area tree). A place with none simply leaves those parts out.

export type Season = "dry" | "drying" | "wet";

export type AreaNotes = {
  // Short quick facts for the banner ("Best time" · "Dec – May").
  facts: { label: string; value: string }[];
  // Who it suits, under What it's like.
  goodFor?: string;
  // January to December.
  seasons: [Season, Season, Season, Season, Season, Season, Season, Season, Season, Season, Season, Season];
  // Tips under the months.
  timing: { title: string; text: string }[];
  // The way there, step by step, and how long it takes in all.
  route: { what: string; note: string; time: string }[];
  routeSummary: string;
  // A line on getting around, by What to book group.
  around?: Partial<Record<"rental" | "transfer" | "activity", string>>;
  // Each town to stay in, by its slug: a short tag and a line on what it is like.
  towns?: Record<string, { tag: string; line: string }>;
  know: { topic: KnowTopic; title: string; text: string }[];
  questions?: { question: string; answer: string }[];
};

export type KnowTopic = "cash" | "signal" | "weather" | "respect" | "food" | "health";

export const SEASON_LABEL: Record<Season, string> = { dry: "Dry", drying: "Drying", wet: "Wet" };

export const AREA_NOTES: Record<string, AreaNotes> = {
  "bantayan-island": {
    facts: [
      { label: "Best time", value: "Dec – May" },
      { label: "From Cebu City", value: "4–5 h, bus + ferry" },
      { label: "Money", value: "Bring cash" },
      { label: "Signal", value: "Good in towns" },
    ],
    goodFor: "Good for beach days, couples, families and slow travel. Not for nightlife or big resorts.",
    seasons: ["dry", "dry", "dry", "dry", "dry", "wet", "wet", "wet", "wet", "wet", "drying", "dry"],
    timing: [
      { title: "Time of day", text: "Beaches before 10 am or after 2 pm; the midday sun is strong." },
      { title: "Tides", text: "The sandbars at Virgin Island and Kota show best at low tide. Tours time it for you." },
      { title: "Holy Week", text: "The island's busiest week. Book stays and the ferry early." },
    ],
    route: [
      { what: "Cebu airport or city to the North Bus Terminal", note: "Taxi or Grab", time: "30–60 min" },
      { what: "Bus or van to Hagnaya port", note: "Or a private transfer from the airport", time: "3–4 h" },
      { what: "Ferry to Santa Fe", note: "Tickets at the port; first boats early morning", time: "~1 h" },
      { what: "Trike to your stay", note: "Waiting at the port", time: "5–15 min" },
    ],
    routeSummary: "About 4–5 hours from Cebu City. No regular flights.",
    around: {
      rental: "The easy way round the island; the roads are flat.",
      transfer: "From Cebu or the airport to Hagnaya and the ferry.",
      activity: "Boats are the only way to Virgin Island.",
    },
    towns: {
      "santa-fe": { tag: "Most stays", line: "Beaches, the ferry port and most places to eat. Best for a first visit." },
      bantayan: { tag: "Local life", line: "The old church, the market and the plaza. A short ride from the beaches." },
      madridejos: { tag: "Quiet", line: "The quiet north, near Kota Park and the lighthouse." },
    },
    know: [
      { topic: "cash", title: "Cash and ATMs", text: "Few ATMs, and they can run out on busy weekends. Bring pesos for trikes, food and small stays." },
      { topic: "signal", title: "Signal and power", text: "Mobile data works in the towns. Brownouts happen, so many stays have a generator." },
      { topic: "weather", title: "Sea and weather", text: "Boats stop in rough seas and typhoon warnings. Keep a spare day around the ferry." },
      { topic: "respect", title: "Respect", text: "Cover shoulders in church. Ask before photographing people at the fish market." },
      { topic: "food", title: "Food to try", text: "Dried fish (bulad), fresh scallops and grilled seafood by the beach." },
      { topic: "health", title: "Health", text: "Strong sun: reef-safe sunscreen and plenty of water. Clinics in Santa Fe and Bantayan town." },
    ],
    questions: [
      { question: "Are there flights to Bantayan?", answer: "Not regular ones. Plan on the ferry from Hagnaya." },
      { question: "Do I need cash?", answer: "Yes. ATMs are few and can run dry; bring enough for your stay." },
      { question: "How many days do I need?", answer: "Two nights to see the highlights; three or four to slow down." },
      { question: "Is it good for kids?", answer: "Yes: the beaches are calm and shallow. Watch the midday sun." },
    ],
  },
};

// Easter Sunday of a year (the Gregorian computus), for the week the islands fill up.
function easter(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

// The months (0 = January) the whole country travels in a year: Holy Week (Palm Sunday to Easter)
// and Christmas to New Year.
export function busyMonths(year: number) {
  const sunday = easter(year);
  const palm = new Date(sunday.getTime() - 7 * 86_400_000);
  return new Set([palm.getUTCMonth(), sunday.getUTCMonth(), 11]);
}
