"use client";

import { useState } from "react";
import { HeartGlyph } from "@/components/discovery/tag-glyphs";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { glassClasses } from "@/components/ui/glass";
import { useToast } from "@/components/ui/toast";
import { startGuestSession } from "@/lib/auth/actions";
import { showAddedBadge } from "./added-badge";
import { chooseTrip, readChosenTrip } from "./chosen-trip";
import { useOptionalTripAdd } from "./trip-add-provider";
import { tripHere, useTripHere } from "./use-trip-here";
import { currentTrips, useFetchTrips, useSaveLandmark, useUnsaveLandmark } from "./use-trips";

const NO_PLACES: string[] = [];

// The places to see saved to the trip a place's page shows (useTripHere), by slug, with the
// saved place's id for removing it. Empty outside a place's page or with no trip.
export function useSavedHere() {
  const places = useOptionalTripAdd()?.places ?? NO_PLACES;
  const { trip } = useTripHere(places);
  return new Map((trip?.saved_landmarks ?? []).map((saved) => [saved.slug, saved.id]));
}

// A heart that saves a place to see to the trip ("want to go": no dates, never booked). It goes
// to the trip the page's banner shows, as an add does (tripHere); with none it starts one, which
// becomes the trip worked on, and signed out it first makes a guest session with no account, as
// a first add does (RAA-177). Saved, a tap takes it off again. `corner`: a round glass button
// over a card's photo, above its stretched title; `panel`: a pill for a side panel's foot.
// Nothing for a partner or admin, who have no trips.
export function SaveLandmarkButton({
  slug,
  name,
  guests,
  variant = "corner",
}: {
  slug: string;
  name: string;
  // A new trip's guests: the page's.
  guests?: number;
  variant?: "corner" | "panel";
}) {
  const flow = useOptionalTripAdd();
  const places = flow?.places ?? NO_PLACES;
  const { session } = useTripHere(places);
  const savedId = useSavedHere().get(slug);
  const fetchTrips = useFetchTrips();
  const save = useSaveLandmark();
  const unsave = useUnsaveLandmark();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  if (!flow?.places || (session && session.user.role !== "guest")) return null;
  const saved = savedId !== undefined;
  const working = busy || save.isPending || unsave.isPending;

  const toggle = async () => {
    if (working || session === undefined) return;
    if (savedId !== undefined) {
      unsave.mutate(savedId);
      return;
    }
    setBusy(true);
    try {
      let userId = session?.user.id;
      if (!userId) {
        const result = await startGuestSession();
        if (!result.ok) {
          toast.show(result.error, { tone: "danger", "data-testid": "trip-toast" });
          return;
        }
        userId = result.user.id;
      }
      // Read now, as an add does: a guest session or another tab may have just changed them.
      const target = tripHere(currentTrips(await fetchTrips(userId)), readChosenTrip(), places);
      const trip = await save.mutateAsync({ slug, tripId: target?.id ?? null, guests });
      if (!target) chooseTrip(trip.id);
      requestAnimationFrame(() => showAddedBadge("Saved to trip"));
    } catch {
      // useSaveLandmark's toast says what went wrong.
    } finally {
      setBusy(false);
    }
  };

  const label = saved ? `Saved to your trip: remove ${name}` : `Save ${name} to your trip`;
  if (variant === "panel")
    return (
      <Button
        type="button"
        variant={saved ? "soft" : "primary"}
        size="touch"
        loading={working}
        aria-pressed={saved}
        aria-label={label}
        onClick={toggle}
        data-testid="landmark-save"
      >
        <HeartGlyph filled={saved} className="size-4" />
        {saved ? "Saved" : "Save place"}
      </Button>
    );
  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={label}
      aria-busy={working || undefined}
      title={saved ? "Saved to your trip" : "Save to your trip"}
      onClick={toggle}
      data-testid="landmark-save"
      className={cn(
        "relative z-10 flex size-11 items-center justify-center rounded-full shadow-soft transition-colors duration-300 ease-calm",
        // Saved: filled in the action colour, as a picked chip is; a white disc vanished on a
        // pale photo. Unsaved: the card's dense glass, which reads over any photo (the light
        // glass turned grey on a white one).
        saved
          ? "border border-white/70 bg-primary text-white hover:bg-primary-hover"
          : cn(glassClasses("card"), "hover:bg-navy/80"),
      )}
    >
      <HeartGlyph filled={saved} className={cn("size-5", working && "motion-safe:animate-pulse")} />
    </button>
  );
}
