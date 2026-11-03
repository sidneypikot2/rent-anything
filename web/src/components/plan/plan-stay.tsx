"use client";

import { useState, type KeyboardEvent, type ReactNode } from "react";
import { CheckGlyph, HomeGlyph, SearchGlyph } from "@/components/discovery/tag-glyphs";
import { useUpdateTrip, type Trip } from "@/components/trips/use-trips";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import type { LatLng } from "@/lib/geo";
import { StayPin, type StayPoint } from "./stay-pin";

type StayChoice = "booked" | "find";

// Where you'll stay, inside its step (the team's A2 question, moved out of step 1): two choices
// side by side. "Find me one here" is picked unless the trip has its own place saved, and only
// it shows the place's stays (`children`). "I've booked a place" pins the guest's own place under
// the row, saved on the trip (every distance starts there). Picking Find forgets a saved pin on
// the trip; the pin stays filled in here, so picking I've booked again brings it back.
export function PlanStayChoice({ trip, center, children }: { trip: Trip; center: LatLng | null; children: ReactNode }) {
  const update = useUpdateTrip();
  const saved = trip.own_stay;
  const [choice, setChoice] = useState<StayChoice>(saved ? "booked" : "find");
  const [pin, setPin] = useState<StayPoint>({ name: saved?.name ?? "", location: saved?.location ?? null });
  const unsaved =
    pin.location !== null &&
    (!saved || saved.location.lat !== pin.location.lat || saved.location.lng !== pin.location.lng || (saved.name ?? "") !== pin.name.trim());

  const save = (stay: { lat: number; lng: number; name: string | null } | null) =>
    update.mutate({ id: trip.id, changes: { name: trip.name, guests: trip.guests, stay } });

  const pickFind = () => {
    setChoice("find");
    if (saved) save(null);
  };
  // The map opens on the place, else on the guest's saved pin; with neither (the place's
  // points didn't load) there is nothing to pin on.
  const mapCenter = center ?? saved?.location ?? null;

  // A radio group's keys: the arrows move to the other answer and pick it; Tab leaves the group.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    const next: StayChoice = choice === "booked" ? "find" : "booked";
    if (next === "find") pickFind();
    else setChoice("booked");
    event.currentTarget.querySelector<HTMLButtonElement>(`[data-choice="${next}"]`)?.focus();
  };

  return (
    <div className="flex flex-col gap-2">
      <div role="radiogroup" aria-label="Where are you staying?" onKeyDown={onKeyDown} className="grid gap-2 min-[26rem]:grid-cols-2">
        <StayOption
          value="booked"
          on={choice === "booked"}
          onPick={() => setChoice("booked")}
          icon={<HomeGlyph className="size-5" />}
          title="I've booked a place"
          note="A hotel, a friend's house, an address"
          testId="plan-stay-booked"
        />
        <StayOption
          value="find"
          on={choice === "find"}
          onPick={pickFind}
          icon={<SearchGlyph className="size-5" />}
          title="Find me one here"
          note="Pick a stay below; distances start from there"
          testId="plan-stay-find"
        />
      </div>
      {choice === "booked" && (
        <div className="flex flex-col gap-2 rounded-card border border-line p-3">
          {mapCenter ? (
            <StayPin value={pin} onChange={setPin} center={mapCenter} />
          ) : (
            <p className="text-sm text-muted">The map can&apos;t load right now. Pick a stay under Find me one here, or try again later.</p>
          )}
          {saved && !unsaved ? (
            <p className="flex items-center gap-1.5 text-sm font-semibold text-forest">
              <CheckGlyph className="size-4" />
              Saved{saved.name ? `: ${saved.name}` : ""}. Distances start here.
            </p>
          ) : (
            mapCenter && <Button
              type="button"
              size="md"
              glyph="check"
              disabled={!pin.location}
              loading={update.isPending}
              onClick={() => pin.location && save({ lat: pin.location.lat, lng: pin.location.lng, name: pin.name.trim() || null })}
              data-testid="plan-stay-save"
              className="self-start"
            >
              {update.isPending ? "Saving…" : "Save my place"}
            </Button>
          )}
        </div>
      )}
      {choice === "find" && children}
    </div>
  );
}

// One answer to "Where are you staying?", as the team drew it: a radio card with an icon, its
// title and a line under it. Two share a row from 26rem (stacked on a narrow phone, where side by
// side squeezes the notes to four lines); below sm the icon well goes.
function StayOption({
  value,
  on,
  onPick,
  icon,
  title,
  note,
  testId,
}: {
  value: StayChoice;
  on: boolean;
  onPick: () => void;
  icon: ReactNode;
  title: string;
  note: string;
  testId: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      // One stop in the tab order: the picked answer.
      tabIndex={on ? 0 : -1}
      data-choice={value}
      onClick={onPick}
      data-testid={testId}
      className={cn(
        "flex min-h-16 items-start gap-3 rounded-card sm:items-center border bg-surface p-3 text-left transition-colors duration-300 ease-calm",
        on ? "border-primary bg-action-tint ring-1 ring-primary" : "border-line hover:bg-surface-2",
      )}
    >
      <span
        aria-hidden
        className={cn("flex size-11 shrink-0 items-center max-sm:hidden justify-center rounded-control", on ? "bg-primary text-white" : "bg-mist text-primary")}
      >
        {icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-semibold text-navy">{title}</span>
        <span className="text-sm text-muted">{note}</span>
      </span>
      <span aria-hidden className={cn("size-5 shrink-0 rounded-full border-2", on ? "border-[6px] border-primary" : "border-line-strong")} />
    </button>
  );
}
