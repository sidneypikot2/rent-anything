"use client";

import dynamic from "next/dynamic";
import { useEffect, useId, useRef, useState } from "react";
import { FeatureGlyph, MapGlyph, MoveGlyph, PlaceGlyph } from "@/components/discovery/tag-glyphs";
import { ComboboxField } from "@/components/ui/combobox-field";
import { Stepper } from "@/components/ui/stepper-field";
import { Field } from "@/components/ui/field";
import { TicketRow } from "@/components/ui/ticket";
import { reverseGeocode, searchPlaces, type LatLng, type PlaceSuggestion } from "@/lib/map";
import { formatPeso } from "@/lib/money";
import { zonesText, type DeliveryZone } from "./delivery-zones";

// MapLibre loads only once a delivery is picked.
const ZoneMap = dynamic(() => import("./zone-map"), { ssr: false, loading: () => <div className="h-64 w-full rounded-control bg-mist" /> });

// A vehicle rental's delivery and pick-up (RAA-195): the shop brings it to the guest and/or
// collects it from them at the end, each for the fee of the delivery zone their pin is in
// (RAA-205: the shop's, nil when not offered), at the address they picked, with notes for the
// rider. The API prices it and refuses a pin out of reach; the browser only says the fees.
export type Delivery = { delivery: boolean; returnPickup: boolean; address: string; location: LatLng | null; notes: string };

export const NO_DELIVERY: Delivery = { delivery: false, returnPickup: false, address: "", location: null, notes: "" };


export const ADDRESS_LENGTH = 200;

// The fees a shop asks, each nil when it doesn't offer it; `from` when its models differ and
// these are the lowest. A motorcycle shop's child helmets (RAA-205): per helmet and day, 0
// included, nil (or left out) when it has none.
export type DeliveryFees = { delivery: number | null; returnPickup: number | null; childHelmet?: number | null; from?: boolean };

type Rate = { delivery_fee_cents: number | null; return_pickup_fee_cents: number | null; child_helmet_fee_cents?: number | null };

// The fees several models picked together share: an option only when every one offers it,
// at the lowest fee (`from` when they differ).
export function sharedFees(rates: (Rate | null)[]): DeliveryFees {
  const shared = (fees: (number | null)[]) => (fees.length > 0 && fees.every((fee) => fee !== null) ? Math.min(...(fees as number[])) : null);
  const deliveries = rates.map((rate) => rate?.delivery_fee_cents ?? null);
  const pickups = rates.map((rate) => rate?.return_pickup_fee_cents ?? null);
  const helmets = rates.map((rate) => rate?.child_helmet_fee_cents ?? null);
  const differ = (fees: (number | null)[]) => new Set(fees).size > 1;
  return {
    delivery: shared(deliveries),
    returnPickup: shared(pickups),
    childHelmet: shared(helmets),
    from: differ(deliveries) || differ(pickups) || differ(helmets),
  };
}

export function wantsDelivery(choice?: Delivery | null) {
  return Boolean(choice && (choice.delivery || choice.returnPickup));
}

// Ticked but with no address or pin yet: the add waits for both.
export function needsAddress(choice?: Delivery | null) {
  return wantsDelivery(choice) && (!choice?.address.trim() || !choice.location);
}

// The fields an add or an item change sends; nothing when neither is ticked.
export function deliveryBody(choice?: Delivery | null) {
  if (!choice || !wantsDelivery(choice)) return {};
  return {
    delivery: choice.delivery,
    return_pickup: choice.returnPickup,
    delivery_address: choice.address.trim(),
    ...(choice.location ? { delivery_location: choice.location } : {}),
    delivery_notes: choice.notes.trim() || null,
  };
}

// What a vehicle item or booking says of it, whether or not the shop brings it (RAA-205):
// "Dropped off and picked up · Kota Beach Resort", or that the guest goes to the shop, then its
// child helmets. Nothing for anything else (`vehicle` false).
export function deliveryText(
  record: { delivery?: boolean; return_pickup?: boolean; delivery_address?: string | null; child_helmets?: number },
  vehicle: boolean,
) {
  if (!vehicle && !record.delivery && !record.return_pickup) return null;
  const how = record.delivery || record.return_pickup ? `${deliveryHow(record.delivery, record.return_pickup)} · ${record.delivery_address ?? ""}` : AT_THE_SHOP;
  return record.child_helmets ? `${how} · ${childHelmetsText(record.child_helmets)}` : how;
}

export function childHelmetsText(count: number) {
  return `${count} child ${count === 1 ? "helmet" : "helmets"}`;
}

// A child helmet's fee as a guest reads it: "Included", or "₱50 a helmet a day".
export function childHelmetFeeText(cents: number, from?: boolean) {
  return cents === 0 && !from ? "Included" : `${from ? "from " : ""}${formatPeso(cents)} a helmet a day`;
}

export const AT_THE_SHOP = "You collect and return it at the shop";

export function deliveryHow(delivery?: boolean, returnPickup?: boolean) {
  return delivery ? (returnPickup ? "Dropped off and picked up" : "Dropped off") : "Picked up at the end";
}

// How a vehicle reaches the guest, as its card's badge says it (RAA-205), from what the shop
// offers (several models: what they all offer, `sharedFees`).
export function handoverLabel(fees: Pick<DeliveryFees, "delivery" | "returnPickup">) {
  if (fees.delivery !== null) return fees.returnPickup !== null ? "Drop-off and pick-up" : "Drop-off only";
  return fees.returnPickup !== null ? "Pick-up only" : "Collect at the shop";
}

const feeText = (cents: number, from?: boolean) => (cents === 0 && !from ? "Free" : `${from ? "from " : ""}${formatPeso(cents)} a vehicle`);

// The two choices as ticket rows, each only when the shop offers it, then where the rider goes
// once one is ticked (`DeliveryPlace`: the address, the pin on the shop's zones, notes; around
// `center`, the listing's rounded point). Renders nothing when the shop offers neither.
export function DeliveryOptions({
  fees,
  value,
  onChange,
  zones,
  center,
}: {
  fees: DeliveryFees;
  value: Delivery;
  onChange: (value: Delivery) => void;
  zones?: DeliveryZone[] | null;
  center?: LatLng | null;
}) {
  const deliveryId = useId();
  const pickupId = useId();
  if (fees.delivery === null && fees.returnPickup === null) return null;
  const box = "size-5 shrink-0 rounded border-line-strong accent-primary";
  return (
    <>
      {fees.delivery !== null && (
        <TicketRow
          icon={<MapGlyph />}
          label={<label htmlFor={deliveryId}>Delivery</label>}
          value="Bring it to me"
          detail={zones?.length ? zonesText(zones) : feeText(fees.delivery, fees.from)}
          control={
            <input
              id={deliveryId}
              type="checkbox"
              className={box}
              checked={value.delivery}
              onChange={(event) => onChange({ ...value, delivery: event.currentTarget.checked })}
              data-testid="delivery-toggle"
            />
          }
          data-testid="delivery-row"
        />
      )}
      {fees.returnPickup !== null && (
        <TicketRow
          icon={<MoveGlyph />}
          label={<label htmlFor={pickupId}>Pick-up at the end</label>}
          value="Collect it from me"
          detail={zones?.length ? "Same zones as delivery" : feeText(fees.returnPickup, fees.from)}
          control={
            <input
              id={pickupId}
              type="checkbox"
              className={box}
              checked={value.returnPickup}
              onChange={(event) => onChange({ ...value, returnPickup: event.currentTarget.checked })}
              data-testid="return-pickup-toggle"
            />
          }
          data-testid="return-pickup-row"
        />
      )}
      {wantsDelivery(value) && center && <DeliveryPlace value={value} onChange={onChange} zones={zones ?? []} center={center} />}
    </>
  );
}

// Child helmets (RAA-205) as a ticket row: how many, one a vehicle at most (`max`), and their fee.
// Nothing when the shop has none.
export function ChildHelmetsRow({
  fee,
  from,
  value,
  max,
  onChange,
}: {
  fee: number | null | undefined;
  from?: boolean;
  value: number;
  max: number;
  onChange: (value: number) => void;
}) {
  if (fee === null || fee === undefined) return null;
  return (
    <TicketRow
      icon={<FeatureGlyph name="helmet" />}
      label="Child helmets"
      value={childHelmetFeeText(fee, from)}
      detail={`up to ${max}, one a vehicle`}
      control={<Stepper label="Child helmets" value={Math.min(value, max)} min={0} max={max} onChange={onChange} testId="child-helmets" />}
      data-testid="child-helmets-row"
    />
  );
}

// Where the guest goes for the vehicle when the shop doesn't bring it (RAA-205): its place only,
// as the exact address comes once the booking is paid (SPEC.md, Trust).
export function AtTheShopRow({ place }: { place?: string | null }) {
  return (
    <TicketRow
      icon={<PlaceGlyph />}
      label="Pick up and return"
      value={place ? `At the shop in ${place}` : "At the shop"}
      detail="exact address once you've paid"
      data-testid="at-the-shop-row"
    />
  );
}

const SEARCH_DELAY_MS = 200;

// Where the shop brings the vehicles and collects them from (RAA-205): an address picked as it is
// typed (places near the shop), which drops the pin; the pin, tapped or dragged to the exact spot,
// fills an empty address from what is there; and notes for the rider. The rings around the shop's
// rounded point are approximate: the API prices the pin.
export function DeliveryPlace({
  value,
  onChange,
  zones,
  center,
}: {
  value: Delivery;
  onChange: (value: Delivery) => void;
  zones: DeliveryZone[];
  center: LatLng;
}) {
  const [found, setFound] = useState<PlaceSuggestion[]>([]);
  const [unreachable, setUnreachable] = useState(false);
  // The latest value, for the address looked up after a drag.
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);
  // The address the pin filled in, replaced by the next drag; one the guest typed is kept.
  const filledRef = useRef<string | null>(null);

  const query = value.address.trim();
  const { lat, lng } = center;
  useEffect(() => {
    if (query.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      searchPlaces(query, { lat, lng }, controller.signal)
        .then((places) => {
          setFound(places);
          setUnreachable(false);
        })
        .catch(() => {
          if (!controller.signal.aborted) setUnreachable(true);
        });
    }, SEARCH_DELAY_MS);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query, lat, lng]);

  const lookupRef = useRef<AbortController | undefined>(undefined);
  function placePin(point: LatLng) {
    onChange({ ...valueRef.current, location: point });
    const typed = valueRef.current.address.trim();
    if (typed && typed !== filledRef.current) return;
    lookupRef.current?.abort();
    const controller = new AbortController();
    lookupRef.current = controller;
    reverseGeocode(point, controller.signal)
      .then((place) => {
        if (!place || controller.signal.aborted) return;
        const name = place.name ?? ([place.housenumber, place.street].filter(Boolean).join(" ") || place.locality || place.city);
        if (!name) return;
        filledRef.current = name;
        onChange({ ...valueRef.current, address: name.slice(0, ADDRESS_LENGTH) });
      })
      .catch(() => undefined);
  }

  const options = found.map((place, index) => ({ value: String(index), label: place.detail ? `${place.name} · ${place.detail}` : place.name }));
  return (
    <div className="flex flex-col gap-3 px-3.5 py-3" data-testid="delivery-place">
      <ComboboxField
        label={value.delivery ? "Where should the rider bring it?" : "Where should the rider collect it?"}
        placeholder="Kota Beach Resort"
        value={value.address}
        maxLength={ADDRESS_LENGTH}
        options={query.length >= 2 ? options : []}
        onChange={(text, option) => {
          const place = option ? found[Number(option.value)] : undefined;
          filledRef.current = null;
          onChange(place ? { ...value, address: place.name, location: place.point } : { ...value, address: text });
        }}
        hint={unreachable ? "Place search isn't answering: drop the pin on the map instead." : undefined}
        data-testid="delivery-address"
      />
      <ZoneMap center={center} zones={zones} pin={value.location} onPin={placePin} approximate />
      <p className="text-small text-muted">
        {value.location ? "Drag the pin to the exact spot." : "Pick a place above, or tap the map where the rider meets you."} Rings are approximate.
      </p>
      <Field
        label="Notes for the rider"
        placeholder="Room 12, beside the sari-sari store"
        value={value.notes}
        maxLength={ADDRESS_LENGTH}
        onChange={(event) => onChange({ ...value, notes: event.currentTarget.value })}
        data-testid="delivery-notes"
      />
    </div>
  );
}
