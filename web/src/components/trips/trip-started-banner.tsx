"use client";

import { useEffect, useState } from "react";

// Where "Start your trip" lands (RAA-80): the trip begins with the first thing added to it.
// `?start=trip` is read once and then dropped from the address, so a reload, a shared link or
// the return from signing up mid-add doesn't show it again. The banner keeps its own state,
// so it stays while the visitor sets the dates it asks for (which rewrites the query).
export function TripStartedBanner({ name, show }: { name: string; show: boolean }) {
  const [visible] = useState(show);

  useEffect(() => {
    if (!show) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("start");
    window.history.replaceState(window.history.state, "", url);
  }, [show]);

  if (!visible) return null;
  return (
    <div data-testid="trip-started" className="rounded-2xl border border-line bg-mist p-4">
      <p className="font-display text-2xl font-bold italic leading-tight">Your {name} trip — add your first thing</p>
      <p className="mt-1 text-sm text-pretty text-muted">
        Set your dates, then add a ride, a tour or a stay below. Saving is free, and there&apos;s nothing to pay yet.
      </p>
    </div>
  );
}
