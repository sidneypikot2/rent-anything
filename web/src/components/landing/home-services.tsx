import Link from "next/link";
import { Suspense } from "react";
import { getArea } from "@/api/discovery";
import { TRIP_ORDER_GROUPS } from "@/components/discovery/categories";
import { CategoryGlyph, ChevronGlyph } from "@/components/discovery/tag-glyphs";
import { cn } from "@/components/ui/cn";
import { LAUNCH_AREA } from "./launch-area";

const AREA_HREF = `/${LAUNCH_AREA.slug}`;

type GroupKey = (typeof TRIP_ORDER_GROUPS)[number]["group"];

// Each kind's tile: a pale wash of its map pin's hue with the icon in the hue itself. Full class
// names, so Tailwind finds them.
const TILE: Record<GroupKey, string> = {
  transfer: "bg-pin-transfer/12 text-pin-transfer",
  stay: "bg-pin-stay/10 text-pin-stay",
  activity: "bg-pin-activity/12 text-pin-activity",
  rental: "bg-pin-rental/12 text-pin-rental",
  gear: "bg-pin-gear/10 text-pin-gear",
};

// The team's E's words and icons where they differ from the groups' own.
const LABEL: Partial<Record<GroupKey, string>> = { rental: "Rentals" };
const ICON: Partial<Record<GroupKey, string>> = { gear: "Camera" };
const BLURB: Record<GroupKey, string> = {
  transfer: "Vans and port pickups",
  stay: "Cottages and hotels",
  activity: "Island hopping",
  rental: "Scooters and trikes",
  gear: "Snorkels and cameras",
};

// "Book just one thing" (2026-11-08: the kinds alone, no listings): the hero's Book one thing
// scrolls here (`#book-one`). Each of the five kinds opens the launch area's What to book on that
// kind (`?show=`), where its listings can be compared and added; the count of each streams in,
// and the tiles work without it.
export function HomeServices() {
  return (
    <section id="book-one" aria-labelledby="one-thing" className="flex flex-col gap-3 lg:gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="one-thing" className="font-display text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          Book just one thing
        </h2>
        <p className="text-muted">No plan needed: pick what you need on {LAUNCH_AREA.name}.</p>
      </div>
      <Suspense fallback={<KindTiles />}>
        <CountedTiles />
      </Suspense>
    </section>
  );
}

async function CountedTiles() {
  const area = await getArea(LAUNCH_AREA.slug).catch((error: unknown) => {
    console.error(error);
    return null;
  });
  if (!area) return <KindTiles />;
  const counts: Partial<Record<GroupKey, number>> = {};
  for (const listing of area.listings) counts[listing.group] = (counts[listing.group] ?? 0) + 1;
  return <KindTiles counts={counts} />;
}

// The five kinds, in the order a trip needs them. A phone shows them five across, icon over name;
// from sm two and three across with their blurb; from lg one row.
function KindTiles({ counts }: { counts?: Partial<Record<GroupKey, number>> }) {
  return (
    <ul className="grid grid-cols-5 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5 lg:gap-4">
      {TRIP_ORDER_GROUPS.map((group) => {
        const count = counts?.[group.group];
        return (
          <li key={group.id}>
            <Link
              href={`${AREA_HREF}?show=${group.id}#listings`}
              data-testid="home-service"
              className="group flex h-full flex-col items-center gap-1.5 text-center text-small text-foreground sm:flex-row sm:gap-3.5 sm:rounded-card sm:border sm:border-line sm:p-3 sm:text-left sm:transition-[box-shadow,border-color] sm:duration-300 sm:ease-calm sm:hover:border-line-strong sm:hover:shadow-soft"
            >
              <span
                aria-hidden
                className={cn(
                  "flex aspect-square w-full max-w-20 items-center justify-center rounded-2xl transition-[translate] duration-300 ease-calm motion-safe:group-hover:-translate-y-0.5 sm:size-12 sm:shrink-0 sm:rounded-xl motion-safe:sm:group-hover:translate-y-0",
                  TILE[group.group],
                )}
              >
                <CategoryGlyph name={ICON[group.group] ?? group.icon} className="size-6.5 sm:size-5.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block sm:text-base sm:font-semibold">{LABEL[group.group] ?? group.short}</span>
                <span className="block text-small leading-snug text-muted max-sm:hidden">
                  {count ? `${count} · ${BLURB[group.group]}` : BLURB[group.group]}
                </span>
              </span>
              <ChevronGlyph direction="right" className="size-4 shrink-0 text-muted max-sm:hidden" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
