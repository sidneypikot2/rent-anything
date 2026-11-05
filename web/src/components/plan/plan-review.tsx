"use client";

import Link from "next/link";
import { useState } from "react";
import { BookingStatusBadge } from "@/components/bookings/booking-status";
import { CheckoutSheet } from "@/components/bookings/checkout-sheet";
import { HeartGlyph, PlusGlyph, TickGlyph } from "@/components/discovery/tag-glyphs";
import { BOOKING_STATE } from "@/components/landing/launch-area";
import { guestsLabel, formatDateRange, thingCount } from "@/components/trips/format";
import { ItemThumb } from "@/components/trips/item-thumb";
import { bookable } from "@/components/trips/trip-details";
import { useTripHere } from "@/components/trips/use-trip-here";
import { itemPriceLabel, itemProblem, itemQuote, pickedTotal, useTripQuote, type Trip } from "@/components/trips/use-trips";
import { Button, ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/components/ui/cn";
import { stayPoint, type PlanPlace } from "./plan-data";
import { dayParts, pickStatuses, planDays, type DayEvent, type DayGap, type PickStatus } from "./plan-days";
import { PlanFoot, PlanHeading } from "./plan-frame";
import { PlanReviewSkeleton } from "./plan-skeletons";

// Step 3 (the team's A6): the trip day by day, every day saying what happens and when — check-in
// and check-out, a ride's pickup or delivery and its return, a transfer, a tour or each day of a
// several-day one — with what runs through it (the stay's nights, the ride's days), the hearted
// places on the day a tour reaches them or a ride can, and what's still missing as a gap whose
// Add goes back to its checklist row. Send to partners is the cart's checkout for every item
// that can be sent.
export function PlanReview({ place }: { place: PlanPlace }) {
  const { session, trips, trip } = useTripHere(place.places);
  if (session === undefined || (session && trips.isPending))
    return <PlanReviewSkeleton />;
  if (!trip)
    return (
      <div className="flex flex-col items-start gap-3 py-10">
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-navy">No plan here yet</h1>
        <ButtonLink href={`/plan?where=${place.area.slug}`} glyph="arrow">
          Start planning
        </ButtonLink>
      </div>
    );
  return <Review place={place} trip={trip} />;
}

// What an event is, as a row's type leads it (Badge kind): lagoon ink on its tint, one colour for
// every kind, with the kind's icon hue as a dot beside it.
const KIND_DOT: Record<DayEvent["kind"], string> = {
  stay: "bg-kind-stay",
  ride: "bg-kind-rental",
  gear: "bg-kind-rental",
  transfer: "bg-kind-transfer",
  tour: "bg-kind-activity",
};

// Something the trip lacks, with its way back to the step that fixes it.
function GapLink({ gap, back }: { gap: DayGap; back: string }) {
  return (
    <Link
      href={`${back}&choose=${gap.row}`}
      data-testid="plan-gap"
      className={cn(
        "flex min-h-11 items-center justify-between gap-3 rounded-card border border-dashed px-3 py-2 text-sm font-semibold transition-colors duration-300 ease-calm",
        gap.idea ? "border-line-strong text-muted hover:bg-surface-2" : "border-warning/60 bg-warning/5 text-warning hover:bg-warning/10",
      )}
    >
      {gap.text}
      <span className="flex shrink-0 items-center gap-1 text-primary">
        <PlusGlyph className="size-4" />
        Add
      </span>
    </Link>
  );
}

// A picked place and how the trip reaches it. Not reached yet, it is the gap's dashed row, with its
// way to the step that would.
function PickRow({ pick, back }: { pick: PickStatus; back: string }) {
  if (pick.state === "open")
    return pick.row ? (
      <div data-testid="plan-pick" data-state="open">
        <GapLink gap={{ text: `${pick.name} · Not covered yet`, row: pick.row, idea: true }} back={back} />
      </div>
    ) : (
      <p className="flex min-h-11 items-center rounded-card border border-dashed border-line-strong px-3 py-2 text-sm font-semibold text-muted" data-testid="plan-pick" data-state="open">
        {pick.name} · Not covered yet
      </p>
    );
  return (
    <div className="flex min-h-11 flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-card border border-line px-3 py-2" data-testid="plan-pick" data-state={pick.state}>
      <div className="flex min-w-0 flex-col">
        <span className="text-sm font-semibold text-navy">{pick.name}</span>
        {pick.line && <span className="text-small text-muted">{pick.line}</span>}
      </div>
      {pick.state === "tour" ? (
        <Badge tone="emerald">
          <TickGlyph className="size-3.5" />
          Covered by a tour
        </Badge>
      ) : (
        <Badge tone="mist">Your own ride</Badge>
      )}
    </div>
  );
}

function Review({ place, trip }: { place: PlanPlace; trip: Trip }) {
  const quote = useTripQuote(trip.id);
  const [sending, setSending] = useState(false);
  const stay = stayPoint(trip);
  const days = planDays(trip, place, stay?.point ?? null);
  const toSend = trip.items.filter((item) => bookable(item) && !itemProblem(item, itemQuote(quote.data, item)));
  const total = pickedTotal(quote.data, toSend);
  const back = `/plan/${place.area.slug}?trip=${trip.id}`;
  // An auto-named trip ("Bantayan Island · Nov 20–23") already says its dates.
  const dates = formatDateRange(trip.starts_on, trip.ends_on);
  const datesShown = dates && !trip.name.includes(dates) ? dates : null;
  const staying = trip.own_stay ? (trip.own_stay.name ?? "your own place") : stay?.name;
  // "Ready" only once nothing needed is missing; ideas (a ride to a hearted place) don't count.
  const picks = pickStatuses(trip, place, stay?.point ?? null);
  const missing = days?.some((day) => day.gaps.some((gap) => !gap.idea)) ?? false;
  // The date range stays on one line ("Nov 13–15", never "Nov 13–" / "15").
  const title = trip.name.replace(/(\S+)–(\S+)/g, "$1\u2060–\u2060$2");

  return (
    <>
      <div className="pb-2">
        <PlanHeading
          eyebrow={missing ? "Your plan so far" : "Your plan is ready"}
          title={title}
          sub={[datesShown, guestsLabel(trip.guests), staying && `staying at ${staying}`].filter(Boolean).join(" · ")}
        />
      </div>

      {picks.length > 0 && (
        <section className="flex flex-col gap-2 pt-3" aria-labelledby="plan-picks" data-testid="plan-picks">
          <h2 id="plan-picks" className="text-sm font-bold text-muted">
            Places you picked
          </h2>
          {picks.map((pick) => (
            <PickRow key={pick.slug} pick={pick} back={back} />
          ))}
        </section>
      )}

      {days ? (
        <ol className="flex flex-col pt-3 pb-8" data-testid="plan-days">
          {days.map((day, index) => {
            const { weekday, day: number } = dayParts(day.date);
            const lastDay = index === days.length - 1;
            return (
              <li key={day.date} className="flex gap-3" data-testid="plan-day">
                <div className="flex w-12 shrink-0 flex-col items-center">
                  <span className="flex size-12 flex-col items-center justify-center rounded-full bg-navy text-white">
                    <span className="text-xs leading-none font-bold">{weekday}</span>
                    <span className="text-lg leading-tight font-extrabold">{number}</span>
                  </span>
                  {!lastDay && <span aria-hidden className="mt-1 w-0.5 flex-1 bg-line" />}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-2 pb-6">
                  {day.title && <p className="pt-3 text-sm font-bold text-muted">{day.title}</p>}
                  {!day.title && <span className="pt-3" />}
                  {index === 0 && trip.own_stay && (
                    <p className="border-l-2 border-kind-stay/50 py-0.5 pl-3 text-small text-muted">
                      Staying at your own place{trip.own_stay.name ? ` · ${trip.own_stay.name}` : ""}
                    </p>
                  )}
                  {day.events.map((event, at) => {
                    const line = itemQuote(quote.data, event.item);
                    const price = event.priced ? itemPriceLabel(line) : null;
                    return (
                      <div key={`${event.item.id}-${at}`} className="flex flex-col gap-1.5" data-testid="plan-event">
                        <div className="flex items-start gap-3 rounded-card border border-line bg-surface p-3">
                          {event.time ? (
                            <span className="w-14 shrink-0 pt-0.5 text-sm font-extrabold text-navy tabular-nums">{event.time}</span>
                          ) : (
                            <ItemThumb item={event.item} size="sm" />
                          )}
                          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                            <span className="inline-flex items-center gap-1.5 self-start rounded-chip bg-lagoon-tint px-2 py-0.5 text-xs font-bold text-lagoon-ink">
                              <span aria-hidden className={cn("size-2 rounded-full", KIND_DOT[event.kind])} />
                              {event.label}
                            </span>
                            <span className="font-semibold text-navy">{event.item.listing.title}</span>
                            {event.lines.length > 0 && <span className="text-small text-muted">{event.lines.join(" · ")}</span>}
                          </div>
                          {event.priced &&
                            (event.item.booking ? (
                              <BookingStatusBadge status={event.item.booking.status} small />
                            ) : (
                              <span className="shrink-0 text-sm font-extrabold text-primary tabular-nums">{price ?? ""}</span>
                            ))}
                        </div>
                        {event.stops.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {event.stops.map((stop) => (
                              <Badge key={stop.name} tone={stop.hearted ? "emerald" : "mist"}>
                                {stop.hearted && <HeartGlyph filled className="size-3.5" />}
                                {stop.name}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {day.runs.map((run) => (
                    <p
                      key={run.text}
                      className={cn(
                        "border-l-2 py-0.5 pl-3 text-small text-muted",
                        run.kind === "stay" ? "border-kind-stay/50" : run.kind === "ride" ? "border-kind-rental/50" : "border-kind-activity/50",
                      )}
                    >
                      {run.text}
                    </p>
                  ))}
                  {day.rides.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-small font-semibold text-muted">Ride to:</span>
                      {day.rides.map((ride) => (
                        <Badge key={ride.name} tone="emerald">
                          <HeartGlyph filled className="size-3.5" />
                          {ride.name}
                          {ride.far && ` · ${ride.far}`}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {day.gaps.map((gap) => (
                    <GapLink key={gap.text} gap={gap} back={back} />
                  ))}
                  {day.events.length === 0 && day.runs.length === 0 && day.gaps.length === 0 && <p className="text-small text-muted">Nothing planned yet.</p>}
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="py-6 text-muted">Add dates to see your trip day by day.</p>
      )}

      <PlanFoot
        summary={
          <>
            <div className="flex items-baseline justify-between gap-3 font-bold text-navy">
              <span>{toSend.length === 0 ? "Nothing to send yet" : thingCount(toSend.length)}</span>
              <span className="tabular-nums">{toSend.length > 0 ? (total ?? "") : ""}</span>
            </div>
            <p className="text-small text-muted">
              Each goes to its partner as a request; {BOOKING_STATE.answer}, and {BOOKING_STATE.unpaid}.
            </p>
          </>
        }
      >
        <Button type="button" size="md" glyph="arrow" disabled={toSend.length === 0} onClick={() => setSending(true)} data-testid="plan-send">
          Send to partners
        </Button>
      </PlanFoot>
      {sending && <CheckoutSheet trip={trip} items={toSend} onClose={() => setSending(false)} />}
    </>
  );
}
