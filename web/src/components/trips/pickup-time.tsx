"use client";

import { useId } from "react";
import { ClockGlyph } from "@/components/discovery/tag-glyphs";
import { TicketRow } from "@/components/ui/ticket";

// A vehicle rental runs 24 hours a day from its pickup time (RAA-195), in the area's time. The
// API says which of the shop's pickup times are free and when the rental is due back; the
// browser only formats them.
export const RENTAL_TIME_ZONE = "Asia/Manila";

export type PickupTime = { time: string; available: boolean };

// "08:30" as a guest reads it: "8:30 AM".
export function formatPickupTime(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  const suffix = hour < 12 ? "AM" : "PM";
  return `${hour % 12 === 0 ? 12 : hour % 12}:${String(minute).padStart(2, "0")} ${suffix}`;
}

// A moment in the area's time: "Tue, Nov 4 · 8:30 AM".
export function formatRentalMoment(iso: string) {
  const at = new Date(iso);
  const day = at.toLocaleDateString("en-US", { timeZone: RENTAL_TIME_ZONE, weekday: "short", month: "short", day: "numeric" });
  const time = at.toLocaleTimeString("en-US", { timeZone: RENTAL_TIME_ZONE, hour: "numeric", minute: "2-digit" });
  return `${day} · ${time}`;
}

// The time of a moment in the area's time, as the API's pickup times are: "08:30".
export function rentalClock(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", { timeZone: RENTAL_TIME_ZONE, hour: "2-digit", minute: "2-digit", hour12: false });
}

// A dated vehicle rental's times on its card: "Pickup 8:30 AM · back by Tue, Nov 4 · 8:30 AM".
export function rentalTimes(item: { returns_at: string | null }) {
  if (!item.returns_at) return null;
  return `Pickup ${formatPickupTime(rentalClock(item.returns_at))} · back by ${formatRentalMoment(item.returns_at)}`;
}

// The pickup time as a ticket row: a select of the shop's times, those the vehicle isn't back
// for marked taken, and when it is due back under it.
export function PickupTimeRow({
  times,
  value,
  onChange,
  returnsAt,
}: {
  times: PickupTime[];
  value: string | null;
  onChange: (time: string) => void;
  returnsAt?: string | null;
}) {
  const id = useId();
  const firstFree = times.find((slot) => slot.available);
  const taken = times.length > 0 && !times[0].available && firstFree;
  return (
    <TicketRow
      icon={<ClockGlyph />}
      label={<label htmlFor={id}>Pickup time</label>}
      value={returnsAt ? `Return by ${formatRentalMoment(returnsAt)}` : "24 hours a day from pickup"}
      detail={taken ? `free from ${formatPickupTime(firstFree.time)}` : undefined}
      control={
        <select
          id={id}
          value={value ?? ""}
          onChange={(event) => onChange(event.currentTarget.value)}
          className="min-h-11 rounded-control border border-line-strong bg-surface px-3 text-control font-semibold focus:border-primary focus:ring-4 focus:ring-sky-mist focus:outline-none"
          data-testid="pickup-time"
        >
          {times.map((slot) => (
            <option key={slot.time} value={slot.time} disabled={!slot.available}>
              {formatPickupTime(slot.time)}
              {slot.available ? "" : " · taken"}
            </option>
          ))}
        </select>
      }
      data-testid="pickup-row"
    />
  );
}
