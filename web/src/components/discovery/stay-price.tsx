import type { ListingDetail, StayQuote } from "@/api/discovery";
import { Card, CardBody } from "@/components/ui/card";
import { Price } from "@/components/ui/typography";
import { formatPeso } from "@/lib/money";
import { feeText, nightUnit, plural, stayRateTerms } from "@/lib/pricing";

type Rate = NonNullable<ListingDetail["stay_rate"]>;

// "₱1,200 / night · up to 2 guests included" under a stay's title (RAA-105). Extra guests are
// free without an extra-guest fee, so then it says how many the place sleeps instead.
export function stayPriceLine(rate: Rate, sleeps: number | null) {
  const guests =
    rate.extra_guest_fee_cents > 0
      ? `up to ${plural(rate.base_guests, "guest")} included`
      : sleeps
        ? `sleeps ${sleeps}`
        : null;
  return [`${formatPeso(rate.nightly_price_cents)} ${nightUnit(false)}`, guests].filter(Boolean).join(" · ");
}

// The quote's nights by price: "₱1,200 × 3 nights", "₱1,500 × 2 weekend nights".
function nightLines(quote: StayQuote) {
  const groups = new Map<string, { price: number; weekend: boolean; count: number }>();
  for (const night of quote.nights) {
    const key = `${night.price_cents}-${night.weekend}`;
    const group = groups.get(key) ?? { price: night.price_cents, weekend: night.weekend, count: 0 };
    groups.set(key, { ...group, count: group.count + 1 });
  }
  const guests = quote.per_guest ? quote.guests : 1;
  return [...groups.values()].map(({ price, weekend, count }) => ({
    label:
      `${formatPeso(price)} × ${plural(count, weekend ? "weekend night" : "night")}` +
      (quote.per_guest ? ` × ${plural(quote.guests, "guest")}` : ""),
    cents: price * count * guests,
  }));
}

function Row({ label, cents, negative }: { label: string; cents: number; negative?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="tabular-nums">
        {negative ? "−" : ""}
        {formatPeso(cents)}
      </dd>
    </div>
  );
}

// What a stay costs (RAA-105): the rate's terms, and with trip dates the /quotes breakdown or
// the reasons these dates and guests can't be booked (too few nights, too many guests).
// Optional fees are listed as add-ons; picking them waits for checkout. `headline={false}` leaves
// the nightly price out where something beside it already shows it (the side panel's pinned foot).
export function StayPrice({
  listing,
  rate,
  quote,
  datesSet,
  headline = true,
}: {
  listing: ListingDetail;
  rate: Rate;
  quote?: { quote: StayQuote } | { errors: string[] };
  datesSet: boolean;
  headline?: boolean;
}) {
  const perGuest = quote && "quote" in quote ? quote.quote.per_guest : false;
  const terms = stayRateTerms(rate, perGuest);
  const required = listing.fees.filter((fee) => fee.required);
  const addOns = listing.fees.filter((fee) => !fee.required);

  return (
    <Card data-testid="stay-price">
      <CardBody pad="lg" className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          {headline ? (
            <Price amount={formatPeso(rate.nightly_price_cents)} unit={nightUnit(perGuest)} />
          ) : (
            <h3 className="text-sm font-semibold">Price</h3>
          )}
          {terms.length > 0 && (
            <ul className="flex flex-col gap-0.5 text-sm text-muted">
              {terms.map((term) => (
                <li key={term}>{term}</li>
              ))}
            </ul>
          )}
        </div>

        {quote && "quote" in quote ? (
          <dl data-testid="stay-quote" className="flex flex-col gap-2 border-t border-line pt-4 text-sm">
            {nightLines(quote.quote).map((line) => (
              <Row key={line.label} label={line.label} cents={line.cents} />
            ))}
            {quote.quote.extra_guests > 0 && quote.quote.extra_guests_total_cents > 0 && (
              <Row
                label={`${plural(quote.quote.extra_guests, "extra guest")} × ${formatPeso(quote.quote.extra_guest_fee_cents)} × ${plural(quote.quote.nights_count, "night")}`}
                cents={quote.quote.extra_guests_total_cents}
              />
            )}
            {quote.quote.discount && (
              <Row
                label={`${quote.quote.discount.kind === "monthly" ? "Monthly" : "Weekly"} discount (${quote.quote.discount.percent}%)`}
                cents={quote.quote.discount.amount_cents}
                negative
              />
            )}
            {quote.quote.fees.map((fee) => (
              <Row
                key={fee.id}
                label={`${fee.name}${fee.quantity > 1 ? ` (${formatPeso(fee.amount_cents)} × ${fee.quantity})` : ""}`}
                cents={fee.total_cents}
              />
            ))}
            <div className="flex justify-between gap-4 border-t border-line pt-3 text-base font-semibold">
              <dt>
                Total for {plural(quote.quote.nights_count, "night")}, {plural(quote.quote.guests, "guest")}
              </dt>
              <dd className="tabular-nums" data-testid="stay-quote-total">
                {formatPeso(quote.quote.total_cents)}
              </dd>
            </div>
          </dl>
        ) : quote ? (
          <ul role="alert" data-testid="stay-quote-errors" className="flex flex-col gap-1 border-t border-line pt-4 text-sm text-danger">
            {quote.errors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-col gap-1 border-t border-line pt-4 text-sm text-muted">
            <p>
              {datesSet
                ? "Pick a check-out date after check-in to see the total for your stay."
                : "Set your dates and guests to see the total for your stay."}
            </p>
            {required.length > 0 && <p>Fees: {required.map(feeText).join(", ")}.</p>}
          </div>
        )}

        {addOns.length > 0 && (
          <p className="text-sm text-muted">
            Add-ons you can ask for:{" "}
            {addOns.map(feeText).join(", ")}.
          </p>
        )}
      </CardBody>
    </Card>
  );
}
