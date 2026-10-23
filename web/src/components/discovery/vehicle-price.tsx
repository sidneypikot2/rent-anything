import type { ListingDetail } from "@/api/discovery";
import { Card, CardBody } from "@/components/ui/card";
import { Price } from "@/components/ui/typography";
import { formatPeso } from "@/lib/money";
import { feeText, plural } from "@/lib/pricing";

type Rate = NonNullable<ListingDetail["vehicle_rate"]>;

// "₱500 / day · half day ₱300" under a vehicle's title (RAA-150).
export function vehiclePriceLine(rate: Rate) {
  const halfDay = rate.half_day_price_cents ? `half day ${formatPeso(rate.half_day_price_cents)}` : null;
  return [`${formatPeso(rate.daily_price_cents)} / day`, halfDay].filter(Boolean).join(" · ");
}

// Not offered, free or a fee: a delivery or a pick-up at the end.
function serviceText(cents: number | null) {
  return cents === null ? "Not offered" : cents === 0 ? "Free" : formatPeso(cents);
}

// What a vehicle rental costs (RAA-150): its rates, the deposit, delivery and pick-up, the km
// limit and its fees. Rentals aren't quoted at checkout yet, so it says the partner confirms
// the price.
export function VehiclePrice({ listing, rate }: { listing: ListingDetail; rate: Rate }) {
  const rates: [string, string][] = [
    ["Per day", formatPeso(rate.daily_price_cents)],
    ...(rate.half_day_price_cents
      ? [[`Half day (${plural(rate.half_day_hours, "hour")})`, formatPeso(rate.half_day_price_cents)] as [string, string]]
      : []),
    ...(rate.hourly_price_cents ? [["Per hour", formatPeso(rate.hourly_price_cents)] as [string, string]] : []),
    ...(rate.weekly_price_cents
      ? [["Per week", `${formatPeso(rate.weekly_price_cents)} (${formatPeso(Math.round(rate.weekly_price_cents / 7))} a day)`] as [string, string]]
      : []),
    ...(rate.monthly_price_cents
      ? [["Per month", `${formatPeso(rate.monthly_price_cents)} (${formatPeso(Math.round(rate.monthly_price_cents / 30))} a day)`] as [string, string]]
      : []),
  ];
  const terms: [string, string][] = [
    ["Security deposit", rate.security_deposit_cents ? `${formatPeso(rate.security_deposit_cents)}, refunded on return` : "None"],
    ["Delivery to you", serviceText(rate.delivery_fee_cents)],
    ["Pick-up at the end", serviceText(rate.return_pickup_fee_cents)],
    ...(rate.min_rental_days > 1 ? [["Minimum rental", plural(rate.min_rental_days, "day")] as [string, string]] : []),
    [
      "Km limit",
      rate.km_limit_per_day
        ? `${rate.km_limit_per_day} km a day` +
          (rate.excess_km_fee_cents ? `, then ${formatPeso(rate.excess_km_fee_cents)} per km` : "")
        : "Unlimited",
    ],
  ];
  const required = listing.fees.filter((fee) => fee.required);
  const addOns = listing.fees.filter((fee) => !fee.required);

  return (
    <Card data-testid="vehicle-price">
      <CardBody pad="lg" className="flex flex-col gap-4">
        <Price prefix="from" amount={formatPeso(rate.daily_price_cents)} unit="/ day" />

        <dl data-testid="vehicle-rates" className="flex flex-col gap-2 text-sm">
          {rates.map(([term, value]) => (
            <Row key={term} term={term} value={value} />
          ))}
        </dl>

        <dl className="flex flex-col gap-2 border-t border-line pt-4 text-sm">
          {terms.map(([term, value]) => (
            <Row key={term} term={term} value={value} />
          ))}
        </dl>

        {(required.length > 0 || addOns.length > 0) && (
          <div className="flex flex-col gap-1 text-sm text-muted">
            {required.length > 0 && <p>Fees: {required.map(feeText).join(", ")}.</p>}
            {addOns.length > 0 && <p>Add-ons you can ask for: {addOns.map(feeText).join(", ")}.</p>}
          </div>
        )}

        <p className="rounded-control bg-surface-2 px-4 py-3 text-sm text-muted">
          The partner confirms the final price when they accept your request.
        </p>
      </CardBody>
    </Card>
  );
}

function Row({ term, value }: { term: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{term}</dt>
      <dd className="text-right tabular-nums">{value}</dd>
    </div>
  );
}
