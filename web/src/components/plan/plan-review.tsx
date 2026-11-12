"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckoutSheet } from "@/components/bookings/checkout-sheet";
import { useOpensInNewTab } from "@/components/discovery/business-row";
import { BOOKING_STATE } from "@/components/landing/launch-area";
import { guestsLabel, formatDateRange, thingCount } from "@/components/trips/format";
import { TripAddProvider } from "@/components/trips/trip-add-provider";
import { bookable } from "@/components/trips/trip-details";
import { useTripHere } from "@/components/trips/use-trip-here";
import { itemProblem, itemQuote, pickedTotal, useTripQuote, type Trip } from "@/components/trips/use-trips";
import { Button, ButtonLink } from "@/components/ui/button";
import { stayPoint, type PlanPlace } from "./plan-data";
import { planDays } from "./plan-days";
import { PlanFoot, PlanHeading } from "./plan-frame";
import { PlanReviewBody } from "./plan-review-body";
import { PlanReviewSkeleton } from "./plan-skeletons";
import { PlanSteps } from "./plan-steps";
import { planSteps, planStops, reviewStepHref, tripStepHref, useSkipped } from "./plan-track";

// Step 3 (the team's A6; revamped in RAA-263): the trip day by day (`PlanReviewBody`, which the
// cart and /trips show too, RAA-305), with every picked place and how it is settled beside it from
// lg, under a tab below that. A row opens its listing's details. Send to partners is the cart's
// checkout for every item that can be sent.
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
  return (
    <TripAddProvider places={place.places}>
      <Review place={place} trip={trip} />
    </TripAddProvider>
  );
}

function Review({ place, trip }: { place: PlanPlace; trip: Trip }) {
  const quote = useTripQuote(trip.id);
  const [sending, setSending] = useState(false);
  const router = useRouter();
  const newTab = useOpensInNewTab();
  // A listing opens its own page, whose way back returns to this plan (`plan=1`): in a new tab
  // on a laptop, in this one on a phone.
  const setListing = (id: number) => {
    const href = `/listings/${id}?trip=${trip.id}&plan=1&place=${place.area.slug}`;
    if (newTab) window.open(href, "_blank", "opener");
    else router.push(href);
  };
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
  const missing = days?.some((day) => day.gaps.some((gap) => !gap.idea)) ?? false;
  // The date range stays on one line ("Nov 13–15", never "Nov 13–" / "15").
  const title = trip.name.replace(/(\S+)–(\S+)/g, "$1⁠–⁠$2");
  // The planner's track, Review lit: each step links back to it on the checklist.
  const [skipped] = useSkipped(trip.id);
  const steps = planSteps(place, trip);
  const stops = planStops({
    ...steps,
    skipped,
    tripHref: tripStepHref(trip, place.area.slug),
    reviewHref: reviewStepHref(trip, place.area.slug),
    stepHref: (key) => `${back}&choose=${key}`,
  });

  return (
    <>
      <PlanSteps stops={stops} active="review" />
      <div className="pb-2">
        <PlanHeading
          eyebrow={missing ? "Your plan so far" : "Your plan is ready"}
          title={title}
          sub={[datesShown, guestsLabel(trip.guests), staying && `staying at ${staying}`].filter(Boolean).join(" · ")}
        />
      </div>

      <PlanReviewBody
        trip={trip}
        place={place}
        quote={quote.data}
        onEvent={(item) => setListing(item.listing.id)}
        onListing={setListing}
        back={back}
        layout="beside"
      />

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
