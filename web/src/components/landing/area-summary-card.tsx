import Link from "next/link";
import { getActivities, getDestinations } from "@/api/discovery";
import { countLine, groupDestinations, withSubAreas } from "@/components/discovery/cards";
import { ButtonLink } from "@/components/ui/button";
import { GlassPanel } from "@/components/ui/glass";

// The home hero's card beside the search, from lg (RAA-125): the destination with the most to
// book, what there is there, the activities with the most to book and the towns inside it, and
// a way into its page. It streams in on its own and leaves nothing if the API is asleep.
export async function AreaSummaryCard() {
  const [destinations, activities] = await Promise.all([
    getDestinations().catch(() => null),
    getActivities().catch(() => null),
  ]);
  const lead = destinations && groupDestinations(destinations)[0];
  if (!lead) return null;
  const { area, subAreas } = lead;
  const top = (activities ?? []).filter((activity) => activity.listing_count > 0).slice(0, 2);
  const row = "-mx-2 flex min-h-11 items-center justify-between gap-3 rounded-control px-2 font-semibold hover:bg-glass-hover";

  return (
    <GlassPanel tone="card" className="flex flex-col gap-3 rounded-card p-5">
      <div>
        <p className="font-display text-2xl font-extrabold tracking-tight">{area.name}</p>
        <p className="text-sm text-sky-mist">{countLine(withSubAreas(area, subAreas))}</p>
      </div>
      {top.length > 0 && (
        <div className="border-t border-glass-edge pt-2">
          <p className="text-sm text-sky-mist">Most to book</p>
          <ul>
            {top.map((activity) => (
              <li key={activity.slug}>
                <Link href={`/search?q=${encodeURIComponent(activity.name)}`} className={row}>
                  {activity.name}
                  <span className="text-sm font-bold tabular-nums text-sky-pale">{activity.listing_count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      {subAreas.length > 0 && (
        <div className="border-t border-glass-edge pt-2">
          <p className="text-sm text-sky-mist">Also in {area.name}</p>
          <ul>
            {subAreas.map((sub) => (
              <li key={sub.slug}>
                <Link href={`/${sub.slug}`} className={row}>
                  {sub.name}
                  <span className="text-sm font-bold tabular-nums text-sky-pale">
                    {sub.listing_count > 0 ? `${sub.listing_count} to book` : countLine(sub)} <span aria-hidden>→</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      <ButtonLink href={`/${area.slug}`} size="touch" arrow className="mt-1 justify-between">
        Plan your trip
      </ButtonLink>
    </GlassPanel>
  );
}
