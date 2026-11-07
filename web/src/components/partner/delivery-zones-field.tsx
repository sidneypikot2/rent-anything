"use client";

import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import type { LatLng } from "@/lib/map";
import { fromCents, toCents } from "@/lib/money";

// MapLibre loads only once the partner brings things to the guest.
const ZoneMap = dynamic(() => import("@/components/trips/zone-map"), { ssr: false, loading: () => <div className="h-64 w-full rounded-control bg-mist" /> });

// The DeliveryZoned rules (RAA-205, RAA-271), shared by a vehicle rate and a water activity.
const MAX_ZONES = 5;
const ZONE_KM = { min: 0.1, max: 50 };

// A delivery zone as typed: how far it reaches, in km, and its fee in pesos (empty: free).
export type ZoneValues = { km: string; fee: string };

// One free zone to start from.
export const FIRST_ZONE: ZoneValues = { km: "1", fee: "" };

const optionalCents = (text: string) => (text.trim() ? toCents(text) : null);
const zoneOk = (km: number) => Number.isFinite(km) && km >= ZONE_KM.min && km <= ZONE_KM.max;

// The zones as the API takes them, nearest first.
export function zoneBody(zones: ZoneValues[]) {
  return zones
    .map((zone) => ({ max_distance_m: Math.round(Number(zone.km) * 1000), fee_cents: optionalCents(zone.fee) ?? 0 }))
    .sort((a, b) => a.max_distance_m - b.max_distance_m);
}

// The zones as typed, from what the API sent.
export function toZoneValues(zones: { max_distance_m: number; fee_cents: number }[]): ZoneValues[] {
  return zones.map((zone) => ({ km: String(zone.max_distance_m / 1000), fee: zone.fee_cents ? fromCents(zone.fee_cents) : "" }));
}

// The rules the API checks for zones, said for the form.
export function zonesError(zones: ZoneValues[]): string | undefined {
  const distances = zones.map((zone) => Number(zone.km));
  if (distances.some((km) => !zoneOk(km))) return `Each zone reaches from ${ZONE_KM.min} to ${ZONE_KM.max} km`;
  if (zones.some((zone) => zone.fee.trim() && toCents(zone.fee) === null)) return "Enter each fee in pesos, or leave it empty for free";
  const body = zoneBody(zones);
  if (new Set(body.map((zone) => zone.max_distance_m)).size < body.length) return "Two zones can't end at the same distance";
  if (body.some((zone, index) => index > 0 && zone.fee_cents < body[index - 1].fee_cents)) return "A farther zone can't cost less than a nearer one";
  return undefined;
}

// The delivery zones (RAA-205): rows of "Up to [1] km · ₱ [ ]" (empty is free), at most five,
// and, once the listing has a pin, the rings they make around it, redrawn as they are typed.
export function DeliveryZoneFields({
  zones,
  onChange,
  error,
  location,
  feeLabel,
  beyond = "delivery",
}: {
  zones: ZoneValues[];
  onChange: (zones: ZoneValues[]) => void;
  error?: string;
  location?: LatLng | null;
  feeLabel: string;
  // What stops past the farthest zone: "No delivery beyond 5 km".
  beyond?: string;
}) {
  const set = (index: number, patch: Partial<ZoneValues>) => onChange(zones.map((zone, at) => (at === index ? { ...zone, ...patch } : zone)));
  const body = zoneBody(zones.filter((zone) => zoneOk(Number(zone.km))));
  const farthest = body.at(-1);
  return (
    <div className="flex flex-col gap-3" data-testid="pricing-zones">
      {zones.map((zone, index) => (
        <div key={index} className="grid grid-cols-[1fr_1fr_auto] items-end gap-3" data-testid="pricing-zone">
          <Field
            label={index === 0 ? "Up to (km)" : "Then up to (km)"}
            type="number"
            min={ZONE_KM.min}
            max={ZONE_KM.max}
            step="0.1"
            inputMode="decimal"
            value={zone.km}
            onChange={(event) => set(index, { km: event.target.value })}
            data-testid="pricing-zone-km"
          />
          <Field
            label={feeLabel}
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            placeholder="Free"
            value={zone.fee}
            onChange={(event) => set(index, { fee: event.target.value })}
            data-testid="pricing-zone-fee"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={zones.length === 1}
            onClick={() => onChange(zones.filter((_, at) => at !== index))}
            aria-label="Remove this zone"
          >
            Remove
          </Button>
        </div>
      ))}
      {error && <p className="text-sm font-semibold text-danger">{error}</p>}
      {zones.length < MAX_ZONES && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={() => {
            const last = zones.at(-1);
            onChange([...zones, { km: String(Math.min(Number(last?.km || 0) + 2, ZONE_KM.max)), fee: last?.fee ?? "" }]);
          }}
          data-testid="pricing-zone-add"
        >
          + Add a zone
        </Button>
      )}
      <p className="text-sm text-muted">
        {farthest ? `No ${beyond} beyond ${farthest.max_distance_m / 1000} km, in a straight line from your pin. ` : ""}
        Guests see these rings around an approximate point, never your exact pin.
      </p>
      {location ? (
        <ZoneMap center={location} zones={body} shop />
      ) : (
        <p className="text-sm text-muted">Drop the listing&apos;s pin to see the zones on a map.</p>
      )}
    </div>
  );
}
