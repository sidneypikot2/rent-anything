import Link from "next/link";
import type { ReactNode } from "react";
import { AlertGlyph, CategoryGlyph, TickGlyph } from "@/components/discovery/tag-glyphs";
import { cn } from "@/components/ui/cn";
import type { GettingHere } from "@/components/landing/launch-area";
import { formatDateRange } from "@/lib/dates";
import { ROLE_LABEL } from "./itinerary";
import type { PlanGap } from "./trip-missing";
import { dayRows, type PlanItem, type TripPlan } from "./trip-plan";

// The plan's days, shared by "Your plan" on a place's page (TripPlan) and, read-only, a shared
// trip's page (RAA-178), which is a Server Component: no hooks here, and nothing to click
// without `then`.

export const LINK =
  "relative font-semibold text-link underline-offset-4 after:absolute after:-inset-x-2 after:-inset-y-3 after:content-[''] hover:underline";

// Goes to a section of What to book or a place to see: the page follows hashchange, which
// setting the same hash again wouldn't fire.
export function jumpTo(hash: string) {
  if (window.location.hash === hash) window.dispatchEvent(new HashChangeEvent("hashchange"));
  else window.location.hash = hash;
}

// How a traveller gets here, first in the plan: ticked once the trip has a transfer.
export function GettingHereCard({ route, note, done = false, onFind }: GettingHere & { done?: boolean; onFind?: () => void }) {
  return (
    <div className="flex gap-3 rounded-control border border-line bg-surface-2 p-3" data-testid="plan-getting-here">
      <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-xl bg-mist text-primary">
        <CategoryGlyph name="Van transfer" className="size-5" />
      </span>
      <div className="flex min-w-0 flex-col items-start gap-0.5 text-sm">
        <span className="font-semibold">Getting here</span>
        <span>{route}</span>
        <span className="text-muted">{note}</span>
        {done ? (
          <span className="mt-1 flex items-center gap-1.5 font-semibold text-forest">
            <TickGlyph className="size-3.5" /> Transfer in your trip
          </span>
        ) : (
          onFind && (
            <button type="button" onClick={onFind} className={cn(LINK, "mt-1")}>
              Find a transfer from the port
            </button>
          )
        )}
      </div>
    </div>
  );
}

// The trip day by day (tripPlan): Getting here, what runs through the whole trip (a stay, a
// rental) once, then each day with what happens on it and what it lacks, Going home last, and
// what fits no day. The whole trip, so a trip in two places shows both, the other place named.
// Without `then` it is read-only (a shared trip): no gaps, ideas or links, and no double-stay
// warning, which is the traveller's to fix.
export function PlanDays<T extends PlanItem>({
  plan,
  tripHref: href,
  places,
  gettingHere,
  hasSights = false,
  row,
  then,
}: {
  plan: TripPlan<T>;
  tripHref?: string;
  places: string[];
  gettingHere?: GettingHere;
  hasSights?: boolean;
  row?: (gap: PlanGap) => ReactNode;
  then?: (action: () => void) => () => void;
}) {
  const last = plan.days.length - 1;
  const where = (item: T) => (places.includes(item.area.slug) ? "" : ` · in ${item.area.name}`);
  // What runs through the whole trip is named in full there; its check-in and check-out days say
  // it shorter ("Beachfront nipa cottage", not "…, Santa Fe" again).
  const through = new Set(plan.throughout.map(({ item }) => item.id));
  const name = (item: T) => (through.has(item.id) ? item.listing.title.split(",")[0] : item.listing.title);
  const gapRows = (gaps: PlanGap[]) => row && gaps.length > 0 && <ul className="flex flex-col gap-2">{gaps.map(row)}</ul>;
  return (
    <ol className="flex flex-col gap-4" data-testid="plan-days">
      {gettingHere ? (
        <li>
          <GettingHereCard
            {...gettingHere}
            done={plan.hasTransfer}
            onFind={then && plan.needsTransfer ? then(() => jumpTo("#need-transfer")) : undefined}
          />
        </li>
      ) : (
        row &&
        plan.needsTransfer && (
          <li>
            <ul className="flex flex-col gap-2">{row({ kind: "need", group: "transfer" })}</ul>
          </li>
        )
      )}
      {(plan.throughout.length > 0 || (row && plan.wholeGaps.length > 0)) && (
        <li className="flex flex-col gap-2" data-testid="plan-throughout">
          <h3 className="text-sm font-bold">The whole trip</h3>
          {plan.throughout.length > 0 && (
            <ul className="flex flex-col gap-1 pl-1 text-sm">
              {plan.throughout.map(({ item, from, to }) => (
                <li key={item.id} className="flex items-center gap-2">
                  <TickGlyph className="size-3.5 shrink-0 text-forest" />
                  <span className="min-w-0 truncate">
                    {item.listing.title}
                    <span className="text-muted">
                      {" "}
                      · {formatDateRange(from, to)}
                      {where(item)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {gapRows(plan.wholeGaps)}
        </li>
      )}
      {dayRows(plan.days).map(({ start, days }) => {
        const day = days[0];
        const first = start === 0 && last > 0;
        const home = start === last && last > 0;
        const end = start + days.length - 1;
        return (
          <li key={day.date} className="flex flex-col gap-2" data-testid="plan-day">
            <h3 className="text-sm font-bold">
              {days.length > 1 ? `Days ${start + 1}–${end + 1}` : `Day ${start + 1}`}
              <span className="font-semibold text-muted">
                {" "}
                · {days.length > 1 ? `${dayLabel(day.date)} – ${dayLabel(days[days.length - 1].date)}` : dayLabel(day.date)}
                {first ? " · Arrival day" : home ? " · Going home" : ""}
              </span>
            </h3>
            {day.entries.length > 0 && (
              <ul className="flex flex-col gap-1 pl-1 text-sm">
                {day.entries.map((entry) => (
                  <li key={`${entry.item.id}-${entry.role}`} className="flex items-center gap-2">
                    <TickGlyph className="size-3.5 shrink-0 text-forest" />
                    <span className="min-w-0 truncate">
                      <span className="text-muted">{ROLE_LABEL[entry.role]} · </span>
                      {name(entry.item)}
                      <span className="text-muted">{where(entry.item)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {then && day.doubleStay && (
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 pl-1 text-sm" data-testid="plan-double-stay">
                <span className="flex items-center gap-2 text-warning">
                  <AlertGlyph className="size-4 shrink-0" /> Two stays this night
                </span>
                {href && (
                  <Link href={href} className={LINK}>
                    Open in trip to remove one
                  </Link>
                )}
              </p>
            )}
            {gapRows(day.gaps)}
            {first && gettingHere && <p className="pl-1 text-sm text-muted">Getting here takes most of the day.</p>}
            {/* A free day still offers something to fill it; not the arrival or going-home day,
                which the journey takes. */}
            {day.free && day.gaps.length === 0 && !first && !home && (
              <p className="pl-1 text-sm text-muted">
                {days.length > 1 ? "Free days" : "Free day"}
                {then && (
                  <>
                    {" · "}
                    <button type="button" onClick={then(() => jumpTo(hasSights ? "#places" : "#need-activity"))} className={LINK}>
                      {hasSights ? "pick a place to see" : "find something to do"}
                    </button>
                  </>
                )}
              </p>
            )}
            {home && gettingHere && (
              <p className="pl-1 text-sm text-muted" data-testid="plan-going-home">
                {gettingHere.home}
              </p>
            )}
          </li>
        );
      })}
      {row && plan.apart.length > 0 && (
        <li className="flex flex-col gap-2">
          <h3 className="text-sm font-bold">Not on a day yet</h3>
          <ul className="flex flex-col gap-2">{plan.apart.map(row)}</ul>
        </li>
      )}
      {row && plan.ideas.length > 0 && (
        <li>
          <Ideas ideas={plan.ideas} row={row} />
        </li>
      )}
    </ol>
  );
}

// What the trip could still have here, offered, never counted: a ride, things to do, places to see.
export function Ideas({ ideas, row }: { ideas: PlanGap[]; row: (gap: PlanGap) => ReactNode }) {
  if (ideas.length === 0) return null;
  return (
    <section aria-labelledby="plan-ideas" className="flex flex-col gap-2 border-t border-line pt-4" data-testid="plan-ideas">
      <h3 id="plan-ideas" className="text-sm font-bold">
        Ideas for your days here
      </h3>
      <ul className="flex flex-col gap-2">{ideas.map(row)}</ul>
    </section>
  );
}

// "Mon, Nov 10".
function dayLabel(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}
