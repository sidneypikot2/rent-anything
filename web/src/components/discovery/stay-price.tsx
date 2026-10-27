"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { apiClient } from "@/api/client";
import type { ListingDetail, StayQuote } from "@/api/discovery";
import { roomText, stayRules } from "@/components/trips/party";
import { RoomsAndGuests } from "@/components/trips/rooms-and-guests";
import { datesParty, type TripDates } from "@/components/trips/trip-dates";
import { Card, CardBody } from "@/components/ui/card";
import { Price } from "@/components/ui/typography";
import { formatPeso } from "@/lib/money";
import { feeText, nightUnit, plural, stayRateTerms } from "@/lib/pricing";
import { shownQuoteKey, startingArrangement, stayQuoteQuery } from "./stay-quote";

type Rate = NonNullable<ListingDetail["stay_rate"]>;
type QuoteResult = { quote: StayQuote } | { errors: string[] };
type Arrangement = ReturnType<typeof startingArrangement>;

// The quote's nights by price for one room: "₱1,200 × 3 nights", "₱1,500 × 2 weekend nights".
function nightLines(quote: StayQuote) {
  const groups = new Map<string, { price: number; weekend: boolean; count: number }>();
  for (const night of quote.nights) {
    const key = `${night.price_cents}-${night.weekend}`;
    const group = groups.get(key) ?? { price: night.price_cents, weekend: night.weekend, count: 0 };
    groups.set(key, { ...group, count: group.count + 1 });
  }
  // A shared room is priced per bed: its adults and children, never its infants.
  const room = quote.rooms[0];
  const payers = room ? room.adults + room.children : quote.guests;
  const guests = quote.per_guest ? payers : 1;
  return [...groups.values()].map(({ price, weekend, count }) => ({
    label:
      `${formatPeso(price)} × ${plural(count, weekend ? "weekend night" : "night")}` +
      (quote.per_guest ? ` × ${plural(payers, "guest")}` : ""),
    cents: price * count * guests,
  }));
}

function Row({ label, detail, cents, negative }: { label: string; detail?: string; cents: number; negative?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">
        {label}
        {detail && <span className="block text-xs">{detail}</span>}
      </dt>
      <dd className="tabular-nums">
        {negative ? "−" : ""}
        {formatPeso(cents)}
      </dd>
    </div>
  );
}

// What a stay costs (RAA-105): the rate's terms, and with trip dates the /quotes breakdown or
// the reasons these dates and guests can't be booked (too few nights, too many guests).
// With dates, the guest's rooms and guests (RAA-184): it starts from the page's party in the
// fewest rooms, and each change asks /quotes again; several rooms are priced room by room.
// Optional fees are listed as add-ons; picking them waits for checkout. `headline={false}` leaves
// the nightly price out where something beside it already shows it (the side panel's pinned foot),
// which reads the quote shown here back (shownQuoteKey).
export function StayPrice({
  listing,
  rate,
  dates,
  initialQuote,
  headline = true,
}: {
  listing: ListingDetail;
  rate: Rate;
  dates: TripDates;
  // The server's quote for the starting rooms, on the listing page.
  initialQuote?: QuoteResult;
  headline?: boolean;
}) {
  const [start] = useState(() => startingArrangement(listing, dates));
  const [picked, setPicked] = useState<Arrangement>(start);
  const datesSet = Boolean(dates.from && dates.to);
  const nightsSet = Boolean(dates.from && dates.to && dates.from < dates.to);
  const query = nightsSet ? stayQuoteQuery(listing, dates.from!, dates.to!, picked.rooms, picked.pets) : null;
  const { data: quote } = useQuery({
    queryKey: ["quote", query],
    queryFn: async (): Promise<QuoteResult> => {
      const { data, error, response } = await apiClient().GET("/api/v1/quotes", { params: { query: query! } });
      if (data) return { quote: data };
      if (response.status === 422 && error && "errors" in error) return { errors: error.errors };
      return { errors: ["Couldn't work out the price just now. Try again in a moment."] };
    },
    enabled: query !== null,
    initialData: picked === start ? initialQuote : undefined,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
  const queryClient = useQueryClient();
  useEffect(() => {
    if (quote) queryClient.setQueryData(shownQuoteKey(listing.id, dates), quote);
  }, [quote, queryClient, listing.id, dates]);

  // The rooms the guest can have: those left on every night once a quote has said, else the listing's.
  const [roomsFree, setRoomsFree] = useState<number | null>(null);
  const freeNow = quote && "quote" in quote ? quote.quote.rooms_free : null;
  if (freeNow !== null && freeNow !== roomsFree) setRoomsFree(freeNow);
  const rules = stayRules(listing.details, roomsFree ?? listing.units_count);
  const { adults, children, infants } = datesParty(dates);

  const perGuest = quote && "quote" in quote ? quote.quote.per_guest : false;
  const terms = stayRateTerms(rate, perGuest);
  const required = listing.fees.filter((fee) => fee.required);
  const addOns = listing.fees.filter((fee) => !fee.required);
  const rooms = quote && "quote" in quote ? quote.quote.rooms : [];

  return (
    // Unclipped: the rooms picker opens below the card's edge.
    <Card data-testid="stay-price" clip={false}>
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

        {nightsSet && (
          <RoomsAndGuests
            rooms={picked.rooms}
            pets={picked.pets}
            rules={rules}
            party={{ adults, children, infants }}
            onChange={(next, pets) => setPicked({ rooms: next, pets })}
            data-testid="stay-rooms"
          />
        )}

        {quote && "quote" in quote ? (
          <dl data-testid="stay-quote" className="flex flex-col gap-2 border-t border-line pt-4 text-sm">
            {rooms.length > 1 ? (
              // Each room for its own guests: its nights and extra guests, before the discount.
              rooms.map((room, index) => (
                <Row
                  key={index}
                  label={`Room ${index + 1} · ${roomText(room)}`}
                  detail={[
                    ...nightLines(quote.quote).map((line) => line.label),
                    room.extra_guests > 0 ? `${plural(room.extra_guests, "extra guest")}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                  cents={room.nightly_subtotal_cents + room.extra_guests_total_cents}
                />
              ))
            ) : (
              <>
                {nightLines(quote.quote).map((line) => (
                  <Row key={line.label} label={line.label} cents={line.cents} />
                ))}
                {quote.quote.extra_guests > 0 && quote.quote.extra_guests_total_cents > 0 && (
                  <Row
                    label={`${plural(quote.quote.extra_guests, "extra guest")} × ${formatPeso(quote.quote.extra_guest_fee_cents)} × ${plural(quote.quote.nights_count, "night")}`}
                    cents={quote.quote.extra_guests_total_cents}
                  />
                )}
              </>
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
                {rooms.length > 1 ? `, ${rooms.length} rooms` : ""}
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
              {nightsSet
                ? "Working out the total…"
                : datesSet
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
