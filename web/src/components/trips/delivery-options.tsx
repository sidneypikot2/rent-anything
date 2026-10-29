"use client";

import { useId } from "react";
import { MapGlyph, MoveGlyph } from "@/components/discovery/tag-glyphs";
import { Field } from "@/components/ui/field";
import { TicketRow } from "@/components/ui/ticket";
import { formatPeso } from "@/lib/money";

// A vehicle rental's delivery and pick-up (RAA-195): the shop brings it to the guest and/or
// collects it from them at the end, each for its fee per vehicle (the shop's, nil when not
// offered), to the address they type. The API prices it; the browser only says the fee.
export type Delivery = { delivery: boolean; returnPickup: boolean; address: string };

export const NO_DELIVERY: Delivery = { delivery: false, returnPickup: false, address: "" };

export const ADDRESS_LENGTH = 200;

// The fees a shop asks, each nil when it doesn't offer it; `from` when its models differ and
// these are the lowest.
export type DeliveryFees = { delivery: number | null; returnPickup: number | null; from?: boolean };

// The fees several models picked together share: an option only when every one offers it,
// at the lowest fee (`from` when they differ).
export function sharedFees(rates: ({ delivery_fee_cents: number | null; return_pickup_fee_cents: number | null } | null)[]): DeliveryFees {
  const shared = (fees: (number | null)[]) => (fees.length > 0 && fees.every((fee) => fee !== null) ? Math.min(...(fees as number[])) : null);
  const deliveries = rates.map((rate) => rate?.delivery_fee_cents ?? null);
  const pickups = rates.map((rate) => rate?.return_pickup_fee_cents ?? null);
  const differ = (fees: (number | null)[]) => new Set(fees).size > 1;
  return { delivery: shared(deliveries), returnPickup: shared(pickups), from: differ(deliveries) || differ(pickups) };
}

export function wantsDelivery(choice?: Delivery | null) {
  return Boolean(choice && (choice.delivery || choice.returnPickup));
}

// Ticked but with no address yet: the add waits for one.
export function needsAddress(choice?: Delivery | null) {
  return wantsDelivery(choice) && !choice?.address.trim();
}

// The fields an add or an item change sends; nothing when neither is ticked.
export function deliveryBody(choice?: Delivery | null) {
  if (!choice || !wantsDelivery(choice)) return {};
  return { delivery: choice.delivery, return_pickup: choice.returnPickup, delivery_address: choice.address.trim() };
}

// What an item or a booking says of it: "Delivered to Kota Beach Resort · collected at the end".
export function deliveryText(record: { delivery?: boolean; return_pickup?: boolean; delivery_address?: string | null }) {
  if (!record.delivery && !record.return_pickup) return null;
  return `${deliveryHow(record.delivery, record.return_pickup)} · ${record.delivery_address ?? ""}`;
}

export function deliveryHow(delivery?: boolean, returnPickup?: boolean) {
  return delivery ? (returnPickup ? "Delivered and collected" : "Delivered") : "Collected at the end";
}

const feeText = (cents: number, from?: boolean) => (cents === 0 && !from ? "Free" : `${from ? "from " : ""}${formatPeso(cents)} a vehicle`);

// The two choices as ticket rows, each only when the shop offers it, and the address under them
// once one is ticked (`address={false}`: not yet, the add sheet asks it). Renders nothing when the
// shop offers neither.
export function DeliveryOptions({
  fees,
  value,
  onChange,
  address = true,
}: {
  fees: DeliveryFees;
  value: Delivery;
  onChange: (value: Delivery) => void;
  address?: boolean;
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
          detail={feeText(fees.delivery, fees.from)}
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
          detail={feeText(fees.returnPickup, fees.from)}
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
      {address && wantsDelivery(value) && <DropOffAddress value={value.address} onChange={(text) => onChange({ ...value, address: text })} />}
    </>
  );
}

// Where the shop brings the vehicles and collects them from.
export function DropOffAddress({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="px-3.5 py-3">
      <Field
        label="Drop-off address"
        placeholder="Hotel or address"
        value={value}
        maxLength={ADDRESS_LENGTH}
        onChange={(event) => onChange(event.currentTarget.value)}
        hint={value.trim() ? undefined : "The shop brings it here and collects it from here"}
        data-testid="delivery-address"
      />
    </div>
  );
}
