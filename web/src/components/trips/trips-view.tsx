"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { Toast } from "@/components/ui/toast";
import { DisplayTitle } from "@/components/ui/typography";
import { DeletionBanner } from "./deletion-banner";
import { EditTripSheet } from "./edit-trip-sheet";
import { formatDateRange, itemCount, todayIso } from "./format";
import { NewTripSheet } from "./new-trip-sheet";
import { useTrips, type Trip } from "./use-trips";

type Tab = "upcoming" | "past";

// A trip is past once its last day is behind it (the UTC day, as the API counts it).
// Undated trips are still being planned, so they're upcoming.
function isPast(trip: Trip) {
  return trip.ends_on !== null && trip.ends_on < todayIso();
}

// The Trips page (screen 8): every trip, upcoming or past, each leading to its place in
// the cart. Status follows the items once they can be booked; until checkout exists every
// trip is still being planned. Past trips show here only until their items are deleted.
export function TripsView() {
  const trips = useTrips(true);
  const [tab, setTab] = useState<Tab>("upcoming");
  const [editing, setEditing] = useState<Trip | null>(null);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState<{ id: number; text: string } | null>(null);

  const show = useCallback((text: string) => setNotice({ id: Date.now(), text }), []);
  const dismissNotice = useCallback(() => setNotice(null), []);

  const list = (trips.data ?? []).filter((trip) => isPast(trip) === (tab === "past"));

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <DisplayTitle>Trips</DisplayTitle>
        <Button size="sm" data-testid="new-trip" onClick={() => setCreating(true)}>
          + Plan a new trip
        </Button>
      </div>

      <div className="flex gap-2" role="group" aria-label="Which trips">
        <Pill on={tab === "upcoming"} onClick={() => setTab("upcoming")}>
          Upcoming
        </Pill>
        <Pill on={tab === "past"} onClick={() => setTab("past")}>
          Past
        </Pill>
      </div>

      {trips.isPending ? (
        <p className="text-sm text-muted">Loading your trips…</p>
      ) : trips.isError ? (
        <p role="alert" className="text-sm text-danger">
          {trips.error.message}
        </p>
      ) : list.length === 0 ? (
        <p className="text-sm text-muted">
          {tab === "upcoming"
            ? "No upcoming trips. Plan one, or add something from a destination."
            : "No past trips."}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {list.map((trip) => (
            <li key={trip.id}>
              <Card data-testid="trips-row">
                <CardBody className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/cart?trip=${trip.id}`}
                      className="font-display text-2xl font-bold italic leading-tight hover:text-primary hover:underline"
                    >
                      {trip.name}
                    </Link>
                    <Badge tone="mist">Planning</Badge>
                  </div>
                  <p className="text-sm text-muted">
                    {[
                      formatDateRange(trip.starts_on, trip.ends_on) ?? "No dates yet",
                      itemCount(trip.items.length),
                      trip.destinations.join(", "),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <DeletionBanner trip={trip} onChangeDates={() => setEditing(trip)} />
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <p className="text-sm text-muted">
        The <Link href="/cart" className="text-link hover:underline">cart</Link> shows every trip you&apos;re
        planning, with its items.
      </p>

      {editing && (
        <EditTripSheet
          trip={editing}
          focus="dates"
          onClose={() => setEditing(null)}
          onSaved={(trip) => {
            setEditing(null);
            show(`Saved ${trip.name}`);
          }}
        />
      )}

      {creating && (
        <NewTripSheet
          onClose={() => setCreating(false)}
          onCreated={(trip) => {
            setCreating(false);
            setTab(isPast(trip) ? "past" : "upcoming");
            show(`Created ${trip.name}`);
          }}
        />
      )}

      <Toast data-testid="trips-toast" message={notice?.text ?? null} id={notice?.id} onDismiss={dismissNotice} />
    </>
  );
}
