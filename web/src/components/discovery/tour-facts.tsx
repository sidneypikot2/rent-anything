import type { ListingDetail } from "@/api/discovery";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { Price } from "@/components/ui/typography";
import { formatDateRange } from "@/lib/dates";
import { feeText, priceUnitText } from "@/lib/pricing";
import { formatPeso } from "@/lib/money";
import { durationText, groupText, inclusionText, scheduleText, tourTypeLabel } from "@/lib/tours";

type Tour = NonNullable<ListingDetail["tour"]>;

// "₱3,500 / group · 4 hours" under a tour's title (RAA-111).
export function tourPriceLine(tour: Tour) {
  const price = tour.base_price_cents ? `${formatPeso(tour.base_price_cents)} ${priceUnitText(tour.price_unit)}` : null;
  return [price, durationText(tour.duration_value, tour.duration_unit)].filter(Boolean).join(" · ");
}

// What a guest needs to know about a tour (RAA-111): private or joiner, the group, how long,
// when it runs and its next open days, what's included (or, on a private tour, the add-ons
// a group can pick) and the price. Booking and its totals come with M3.
export function TourFacts({ listing, tour }: { listing: ListingDetail; tour: Tour }) {
  const privateTour = tour.tour_type === "private";
  const next = tour.open_dates.slice(0, 6);
  const fees = listing.fees.filter((fee) => fee.required);
  const facts: [string, string][] = [
    ["Group", groupText(tour.min_guests, tour.max_guests)],
    ["Duration", durationText(tour.duration_value, tour.duration_unit)],
    ["Runs", scheduleText(tour.weekdays, tour.weekdays.length ? 0 : tour.open_dates.length)],
  ];

  return (
    <Card data-testid="tour-facts">
      <CardBody pad="lg" className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {tour.base_price_cents ? (
            <Price prefix="from" amount={formatPeso(tour.base_price_cents)} unit={priceUnitText(tour.price_unit)} />
          ) : (
            <span className="text-sm text-muted">No price yet</span>
          )}
          <Badge tone={privateTour ? "aqua" : "emerald"}>{tourTypeLabel(tour.tour_type)}</Badge>
        </div>

        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[7rem_1fr]">
          {facts.map(([term, value]) => (
            <div key={term} className="contents">
              <dt className="font-semibold text-muted">{term}</dt>
              <dd className="-mt-2 sm:mt-0">{value}</dd>
            </div>
          ))}
        </dl>

        {next.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold">Next open days</span>
            <ul className="flex flex-wrap gap-2" data-testid="tour-open-dates">
              {next.map((date) => (
                <li key={date}>
                  <Badge tone="mist">{formatDateRange(date, date)}</Badge>
                </li>
              ))}
            </ul>
          </div>
        )}

        {tour.inclusions.length > 0 && (
          <div className="flex flex-col gap-2 border-t border-line pt-4">
            <span className="text-sm font-semibold">{privateTour ? "Add-ons your group can choose" : "Included"}</span>
            <ul className="flex flex-col gap-1 text-sm">
              {tour.inclusions.map((inclusion) => (
                <li key={inclusion.kind}>{inclusionText(inclusion, tour.tour_type)}</li>
              ))}
            </ul>
          </div>
        )}

        {fees.length > 0 && <p className="text-sm text-muted">Fees: {fees.map(feeText).join(", ")}.</p>}
      </CardBody>
    </Card>
  );
}
