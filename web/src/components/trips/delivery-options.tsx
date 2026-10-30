"use client";

import { useId } from "react";
import { FeatureGlyph, MapGlyph, MoveGlyph, PlaceGlyph } from "@/components/discovery/tag-glyphs";
import { Stepper } from "@/components/ui/stepper-field";
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

// Ticked but with no address yet: the add waits for one.
export function needsAddress(choice?: Delivery | null) {
  return wantsDelivery(choice) && !choice?.address.trim();
}

// The fields an add or an item change sends; nothing when neither is ticked.
export function deliveryBody(choice?: Delivery | null) {
  if (!choice || !wantsDelivery(choice)) return {};
  return { delivery: choice.delivery, return_pickup: choice.returnPickup, delivery_address: choice.address.trim() };
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
