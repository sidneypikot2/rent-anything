import type { ListingDetail } from "@/api/discovery";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { Price } from "@/components/ui/typography";
import { feeText, priceUnitText } from "@/lib/pricing";
import { formatPeso } from "@/lib/money";
import { durationText, groupText, guestTourTypeLabel, inclusionText } from "@/lib/tours";

type Tour = NonNullable<ListingDetail["tour"]>;

// "₱3,500 / group · 4 hours" under a tour's title (RAA-111).
export function tourPriceLine(tour: Tour) {
  const price = tour.base_price_cents ? `${formatPeso(tour.base_price_cents)} ${priceUnitText(tour.price_unit)}` : null;
  return [price, durationText(tour.duration_value, tour.duration_unit)].filter(Boolean).join(" · ");
}

// What a guest needs to know about a tour (RAA-111): private or joiner, the group, how long,
// what's included (or, on a private tour, the add-ons a group can pick) and the price. Booking and its totals come with M3.
// `head={false}` leaves out the price and the kind, which a side panel already shows (its foot
// and its chips).
export function TourFacts({ listing, tour, head = true }: { listing: ListingDetail; tour: Tour; head?: boolean }) {
  const privateTour = tour.tour_type === "private";
  const fees = listing.fees.filter((fee) => fee.required);
  const facts: [string, string][] = [
    // A shared (joiner) tour's group is everyone on it, not the guest's own party.
    ["Group", privateTour ? groupText(tour.min_guests, tour.max_guests) : `${groupText(tour.min_guests, tour.max_guests)}, shared with other travellers`],
    ["Duration", durationText(tour.duration_value, tour.duration_unit)],
  ];

  return (
    <Card data-testid="tour-facts">
      <CardBody pad="lg" className="flex flex-col gap-5">
        {head && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            {tour.base_price_cents ? (
              <Price prefix="from" amount={formatPeso(tour.base_price_cents)} unit={priceUnitText(tour.price_unit)} />
            ) : (
              <span className="text-sm text-muted">No price yet</span>
            )}
            <Badge tone={privateTour ? "aqua" : "emerald"}>{guestTourTypeLabel(tour.tour_type)}</Badge>
          </div>
        )}

        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[7rem_1fr]">
          {facts.map(([term, value]) => (
            <div key={term} className="contents">
              <dt className="font-semibold text-muted">{term}</dt>
              <dd className="-mt-2 sm:mt-0">{value}</dd>
            </div>
          ))}
        </dl>

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
