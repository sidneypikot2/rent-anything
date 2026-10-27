"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { apiClient } from "@/api/client";
import type { ListingDetail, StayQuote } from "@/api/discovery";
import { AddToTripButton } from "@/components/trips/add-to-trip-button";
import { roomText, stayRules } from "@/components/trips/party";
import { RoomsAndGuests } from "@/components/trips/rooms-and-guests";
import { datesParty, type TripDates } from "@/components/trips/trip-dates";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { Price } from "@/components/ui/typography";
import { formatDateRange } from "@/lib/dates";
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

// A fee as a price line: a pet fee by its pets ("1 pet × ₱200", "× 2 nights" for one a night),
// the others by name, with what they're multiplied by when it's more than one.
function feeLine(fee: StayQuote["fees"][number], quote: StayQuote) {
  if (fee.charged_per === "pet" || fee.charged_per === "pet_night") {
    const nights = fee.charged_per === "pet_night" ? ` × ${plural(quote.nights_count, "night")}` : "";
    return `${plural(quote.pets, "pet")} × ${formatPeso(fee.amount_cents)}${nights}`;
  }
  return `${fee.name}${fee.quantity > 1 ? ` (${formatPeso(fee.amount_cents)} × ${fee.quantity})` : ""}`;
}

function Row({
  label,
  cents,
  negative,
  "data-testid": testId,
}: {
  label: string;
  cents: number;
  negative?: boolean;
  "data-testid"?: string;
}) {
  return (
    <div className="flex justify-between gap-4" data-testid={testId}>
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
// With dates, the guest's rooms and guests (RAA-184): it starts from the page's party in the
// fewest rooms, and each change asks /quotes again; several rooms are priced room by room.
// `add`: Add to trip ends the card, taking the rooms picked here into the add sheet.
// Optional fees are listed as add-ons; picking them waits for checkout. `headline={false}` leaves
// the nightly price out where something beside it already shows it (the side panel's pinned foot),
// which reads the quote shown here back (shownQuoteKey).
export function StayPrice({
  listing,
  rate,
  dates,
  initialQuote,
  headline = true,
  add = false,
}: {
  listing: ListingDetail;
  rate: Rate;
  dates: TripDates;
  // The server's quote for the starting rooms, on the listing page.
  initialQuote?: QuoteResult;
  headline?: boolean;
  add?: boolean;
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
  const rules = stayRules(listing.details, roomsFree ?? listing.units_count, listing.fees);
  const { adults, children, infants } = datesParty(dates);

  const perGuest = quote && "quote" in quote ? quote.quote.per_guest : false;
  const terms = stayRateTerms(rate, perGuest);
  const required = listing.fees.filter((fee) => fee.required);
  const addOns = listing.fees.filter((fee) => !fee.required);
  const rooms = quote && "quote" in quote ? quote.quote.rooms : [];
  const nights = quote && "quote" in quote ? quote.quote.nights_count : 0;
  // "Each room sleeps 5 · 3 free Nov 14 – 16": the beds a room has and, once quoted, the rooms left.
  const roomsLine = [
    rules.sleeps ? (rules.shared ? `Sleeps ${rules.sleeps}` : `Each room sleeps ${rules.sleeps}`) : null,
    roomsFree !== null && !rules.shared ? `${roomsFree} free ${formatDateRange(dates.from, dates.to)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    // Unclipped: the rooms picker opens below the card's edge.
    <Card data-testid="stay-price" clip={false}>
      <CardBody pad="lg" className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {headline ? (
              <Price amount={formatPeso(rate.nightly_price_cents)} unit={nightUnit(perGuest)} />
            ) : (
              <h3 className="text-sm font-semibold">Price</h3>
            )}
            {rules.pets !== 0 && (
              <Badge tone="fact" data-testid="stay-pets-allowed">
                Pets allowed
              </Badge>
            )}
          </div>
          {roomsLine && <p className="text-sm font-medium">{roomsLine}</p>}
          {terms.length > 0 && (
            <ul className="flex flex-col gap-0.5 text-sm text-muted">
              {terms.map((term) => (
                <li key={term}>{term}</li>
              ))}
            </ul>
          )}
        </div>

        {nightsSet && (
          <p className="flex flex-col gap-0.5 text-sm" data-testid="stay-dates">
            <span className="font-semibold">Dates</span>
            <span>
              {formatDateRange(dates.from, dates.to)}
              {nights > 0 ? ` · ${plural(nights, "night")}` : ""}
            </span>
          </p>
        )}

        {nightsSet && (
          <RoomsAndGuests
            rooms={picked.rooms}
            pets={picked.pets}
            rules={rules}
            party={{ adults, children, infants }}
            searched={{ children, infants, pets: datesParty(dates).pets }}
            onChange={(next, pets) => setPicked({ rooms: next, pets })}
            data-testid="stay-rooms"
          />
        )}

        {quote && "quote" in quote ? (
          <dl data-testid="stay-quote" className="flex flex-col gap-2 border-t border-line pt-4 text-sm">
            {perGuest ? (
              // A shared room's beds: its nights by price, each for every guest in a bed.
              nightLines(quote.quote).map((line) => <Row key={line.label} label={line.label} cents={line.cents} />)
            ) : (
              // One line a room: "Room 2 · 4 adults, 1 child · 3 extra", its nights and extra guests.
              rooms.map((room, index) => (
                <Row
                  key={index}
                  label={[`Room ${index + 1}`, roomText(room), room.extra_guests > 0 ? `${room.extra_guests} extra` : null]
                    .filter(Boolean)
                    .join(" · ")}
                  cents={room.nightly_subtotal_cents + room.extra_guests_total_cents}
                  data-testid="stay-quote-room"
                />
              ))
            )}
            {quote.quote.discount && (
              <Row
                label={`${quote.quote.discount.kind === "monthly" ? "Monthly" : "Weekly"} discount (${quote.quote.discount.percent}%)`}
                cents={quote.quote.discount.amount_cents}
                negative
              />
            )}
            {quote.quote.fees.map((fee) => (
              <Row key={fee.id} label={feeLine(fee, quote.quote)} cents={fee.total_cents} />
            ))}
            <div className="flex justify-between gap-4 border-t border-line pt-3 text-base font-semibold">
              <dt>Total</dt>
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

        {add && (
          <div className="flex justify-end">
            <AddToTripButton listing={listing} dates={dates} rooms={nightsSet ? picked : undefined} />
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
