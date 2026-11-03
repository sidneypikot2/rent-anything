"use client";

import { keepPreviousData, useQueries, useQuery } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { apiClient } from "@/api/client";
import type { components } from "@/api/schema";
import type { StayQuote } from "@/api/discovery";
import { counted, headcount, partyOf, partySummary, roomText, unplacedCount, type Room, type StayRules } from "@/components/trips/party";
import { RoomBlock, shownKinds } from "@/components/trips/rooms-and-guests";
import { useTripAdd } from "@/components/trips/trip-add-provider";
import { CoverBar } from "@/components/trips/cover-bar";
import { datesParty, type TripDates } from "@/components/trips/trip-dates";
import type { AddPreview, MixItem } from "@/components/trips/use-trips";
import { ArrowGlyph } from "./tag-glyphs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StepperField } from "@/components/ui/stepper-field";
import { formatPeso } from "@/lib/money";

type Mix = components["schemas"]["stay_mix"];

// One of a partner's room types, each its own stay listing, as the mix picker needs it.
export type MixOffer = {
  listingId: number;
  title: string;
  // "from ₱2,500 / night"
  priceText?: string;
  rules: StayRules;
  preview: AddPreview;
  // What the panel shows of it in a suggestion: its photo, what sets it apart ("Sleeps 4 · Air
  // conditioning") and how to open its details.
  thumb?: ReactNode;
  apart?: string;
  open?: () => void;
};

const LABELS: Record<Mix["label"], string> = {
  cheapest: "Cheapest",
  private: "All private rooms",
  one_type: "One kind of room",
  other: "Also good",
};

// Each picked room type's rooms, by listing: a shared room's one group of guests (by the bed).
type Picks = Record<number, Room[]>;

// "Family room and Beachfront cottage", "A, B and C".
const titles = (names: string[]) =>
  names.length < 3 ? names.join(" and ") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;

// "2 rooms + 2 dorm beds · 5 adults, 1 child · 1 pet": a shared room counts its beds, not a room.
function mixSummary(picked: MixOffer[], picks: Picks, pets: number) {
  const rooms = picked.filter((offer) => !offer.rules.shared).reduce((sum, offer) => sum + picks[offer.listingId].length, 0);
  const beds = picked
    .filter((offer) => offer.rules.shared)
    .reduce((sum, offer) => sum + counted(picks[offer.listingId][0], offer.rules), 0);
  const where = [rooms && `${rooms} ${rooms === 1 ? "room" : "rooms"}`, beds && `${beds} dorm ${beds === 1 ? "bed" : "beds"}`]
    .filter(Boolean)
    .join(" + ");
  return [where, partySummary(picked.flatMap((offer) => picks[offer.listingId]), pets, true)].filter(Boolean).join(" · ");
}

// A mix of one partner's room types for the trip's party (RAA-188, mock option C then A): the
// API's suggestions first (GET /stay_mixes, priced on the server), each with Choose; Customise
// opens one card per room type with its Rooms stepper and, inside the same card, each room's
// guests. Only the counters the search has show (shownKinds). The price is each room type's
// GET /quotes for its rooms, and "Add N stays to trip" adds them all through the add sheet, in
// one request. Each suggestion shows its room types' photos and details, as it stands in for the
// panel's list of them; `fallback` (that list) shows when no suggestion can be made.
export function StayMixPicker({ offers, dates, fallback }: { offers: MixOffer[]; dates: TripDates; fallback?: ReactNode }) {
  const { add, busyListingId } = useTripAdd();
  const party = datesParty(dates);
  const people: Room = { adults: party.adults, children: party.children, infants: party.infants };
  const searched = { children: party.children, infants: party.infants, pets: party.pets };
  const [view, setView] = useState<"suggest" | "edit">("suggest");
  const [picks, setPicks] = useState<Picks>({});
  const [pets, setPets] = useState(0);
  const ids = offers.map((offer) => offer.listingId);

  const mixes = useQuery({
    queryKey: ["stay-mixes", ids, dates.from, dates.to, party],
    queryFn: async (): Promise<{ mixes: Mix[] } | { errors: string[] }> => {
      const { data, error, response } = await apiClient().GET("/api/v1/stay_mixes", {
        params: { query: { "listing_ids[]": ids, starts_on: dates.from!, ends_on: dates.to!, ...party } },
      });
      if (data) return data;
      if (response.status === 422 && error && "errors" in error) return { errors: error.errors };
      return { errors: ["Couldn't find rooms just now. Try again in a moment."] };
    },
    enabled: Boolean(dates.from && dates.to),
    staleTime: 60_000,
  });

  const picked = offers.filter((offer) => (picks[offer.listingId] ?? []).length > 0);
  // The pets go with the first picked room type that takes them.
  const petHost = picked.find((offer) => offer.rules.pets !== 0);
  const petMax = petHost ? (petHost.rules.pets ?? 20) : 0;
  const shownPets = Math.min(pets, petMax);
  const allRooms = picked.flatMap((offer) => picks[offer.listingId]);

  const quotes = useQueries({
    queries: picked.map((offer) => {
      const rooms = picks[offer.listingId];
      const query = {
        listing_id: offer.listingId,
        starts_on: dates.from!,
        ends_on: dates.to!,
        ...partyOf(rooms),
        pets: offer === petHost ? shownPets : 0,
        ...(offer.rules.shared ? {} : { room_guests: JSON.stringify(rooms) }),
      };
      return {
        queryKey: ["quote", query],
        queryFn: async (): Promise<{ quote: StayQuote } | { errors: string[] }> => {
          const { data, error, response } = await apiClient().GET("/api/v1/quotes", { params: { query } });
          if (data) return { quote: data };
          if (response.status === 422 && error && "errors" in error) return { errors: error.errors };
          return { errors: ["Couldn't work out the price just now. Try again in a moment."] };
        },
        placeholderData: keepPreviousData,
        staleTime: 60_000,
      };
    }),
  });

  function choose(mix: Mix) {
    const next: Picks = {};
    for (const item of mix.items) {
      next[item.listing_id] = item.room_guests ?? [{ adults: item.quantity ?? 1, children: 0, infants: 0 }];
    }
    setPicks(next);
    setPets(mix.items.reduce((sum, item) => sum + (item.pets ?? 0), 0));
    setView("edit");
  }

  if (view === "suggest") {
    const result = mixes.data;
    return (
      <section aria-labelledby="mix-title" className="flex flex-col gap-3" data-testid="stay-mix">
        <div>
          <h3 id="mix-title" className="text-lg font-semibold">Rooms for your party</h3>
          <p className="text-sm text-muted">
            {partySummary([people], party.pets, true)} · mixes of these room types that sleep everyone, cheapest first
          </p>
        </div>
        {mixes.isPending ? (
          <p className="rounded-control bg-mist px-3 py-2.5 text-sm text-muted">Finding rooms for your party…</p>
        ) : result && "errors" in result ? (
          <>
            <p role="alert" className="text-sm text-danger">{result.errors.join(" ")}</p>
            {fallback}
          </>
        ) : result && result.mixes.length === 0 ? (
          <>
            <p className="rounded-control bg-mist px-3 py-2.5 text-sm">No mix of these rooms sleeps your party on these dates.</p>
            {fallback}
          </>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {result?.mixes.map((mix, index) => (
              <li
                key={mix.items.map((item) => `${item.listing_id}x${item.rooms}`).join("-")}
                className="card-edge-line flex flex-col gap-2 rounded-card bg-surface p-3"
                data-testid="stay-mix-option"
              >
                <div className="flex items-center justify-between gap-3">
                  <Badge tone="kind">{LABELS[mix.label]}</Badge>
                  <p className="shrink-0 font-semibold tabular-nums">{formatPeso(mix.total_cents)}</p>
                </div>
                <ul className="flex flex-col gap-3">
                  {mix.items.map((item) => {
                    const offer = offers.find((each) => each.listingId === item.listing_id);
                    const many = item.room_guests && item.room_guests.length > 1;
                    const title = item.rooms > 1 ? `${item.rooms} × ${item.title}` : item.title;
                    return (
                      <li key={item.listing_id} className="grid grid-cols-[4rem_minmax(0,1fr)] items-start gap-3">
                        {offer?.thumb ?? <span />}
                        <div className="flex min-w-0 flex-col gap-0.5">
                          {offer?.open ? (
                            <button
                              type="button"
                              data-testid="business-offer"
                              onClick={offer.open}
                              className="group flex items-start justify-between gap-2 text-left font-semibold leading-snug text-link underline-offset-4 hover:underline"
                            >
                              {title}
                              <ArrowGlyph className="mt-0.5 size-4 shrink-0 transition-transform duration-500 ease-calm motion-safe:group-hover:translate-x-0.5" />
                            </button>
                          ) : (
                            <p className="font-semibold leading-snug">{title}</p>
                          )}
                          {offer?.apart && <span className="text-sm text-foreground">{offer.apart}</span>}
                          <ul className="text-sm text-muted">
                            {(item.room_guests ?? [null]).map((room, n) => {
                              const who = room ? roomText(room) : `${item.quantity} in the dorm`;
                              return <li key={n}>{many ? `Room ${n + 1} · ${who}` : who}</li>;
                            })}
                          </ul>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <Button
                  type="button"
                  variant={index === 0 ? "primary" : "soft"}
                  size="touch"
                  onClick={() => choose(mix)}
                  data-testid="stay-mix-choose"
                >
                  Choose
                </Button>
              </li>
            ))}
          </ul>
        )}
        <Button type="button" variant="soft" size="touch" onClick={() => setView("edit")} data-testid="stay-mix-customise">
          Customise rooms
        </Button>
      </section>
    );
  }

  const results = quotes.map((each) => each.data);
  const errors = results.flatMap((result, i) =>
    result && "errors" in result ? result.errors.map((error) => `${picked[i].title}: ${error}`) : [],
  );
  const priced = results.every((result) => result && "quote" in result);
  const total = priced ? results.reduce((sum, result) => sum + (result && "quote" in result ? result.quote.total_cents : 0), 0) : null;
  const guests = headcount(people);
  const placed = guests - unplacedCount(people, allRooms);
  const kinds = shownKinds(allRooms, searched);
  const busy = picked.length > 0 && busyListingId === picked[0].listingId;

  const setRooms = (offer: MixOffer, rooms: Room[]) => setPicks({ ...picks, [offer.listingId]: rooms });

  function addAll() {
    const items: MixItem[] = picked.map((offer) => {
      const rooms = picks[offer.listingId];
      return {
        listingId: offer.listingId,
        title: offer.title,
        quantity: headcount(partyOf(rooms)),
        roomGuests: offer.rules.shared ? null : rooms,
        pets: offer === petHost ? shownPets : 0,
        shared: offer.rules.shared,
      };
    });
    const first = picked[0];
    add({
      listingId: first.listingId,
      title: titles(items.map((item) => item.title)),
      range: true,
      bookingType: "stay",
      startsOn: dates.from,
      endsOn: dates.to,
      quantity: items.reduce((sum, item) => sum + item.quantity, 0),
      // The first room type's picture and partner; its own room count would misname the mix.
      preview: {
        ...first.preview,
        unitsCount: undefined,
        unitsLabel: undefined,
        price: total === null ? undefined : `${formatPeso(total)} for the stay`,
      },
      mix: items,
    });
  }

  return (
    <section aria-labelledby="mix-edit-title" className="flex flex-col gap-3" data-testid="stay-mix-editor">
      <div className="flex items-center justify-between gap-3">
        <h3 id="mix-edit-title" className="text-lg font-semibold">Rooms for your party</h3>
        <button
          type="button"
          onClick={() => setView("suggest")}
          className="tap-target text-sm font-semibold text-link underline underline-offset-4 hover:text-primary"
        >
          ← Suggestions
        </button>
      </div>

      <ul className="flex flex-col gap-2.5">
        {offers.map((offer) => {
          const rooms = picks[offer.listingId] ?? [];
          const { rules } = offer;
          // A shared room is booked by the bed: its stepper counts the beds its one group takes.
          const count = rules.shared ? (rooms[0] ? counted(rooms[0], rules) : 0) : rooms.length;
          const max = rules.shared ? (rules.sleeps ?? 20) : (rules.rooms ?? 9);
          return (
            <li key={offer.listingId} className="card-edge-line flex flex-col gap-2 rounded-card bg-surface p-3" data-testid="stay-mix-type">
              <div className="flex items-start justify-between gap-3">
                <p className="font-semibold">{offer.title}</p>
                {offer.priceText && <p className="shrink-0 text-sm text-muted">{offer.priceText}</p>}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {rules.sleeps && <Badge tone="fact">{rules.shared ? `${rules.sleeps} beds` : `Sleeps ${rules.sleeps}`}</Badge>}
                {!rules.shared && rules.rooms && <Badge tone="fact">{rules.rooms} {rules.rooms === 1 ? "room" : "rooms"}</Badge>}
                {rules.pets !== 0 && <Badge tone="emerald">Pets allowed</Badge>}
              </div>
              <StepperField
                label={rules.shared ? "Beds" : "Rooms"}
                value={count}
                min={0}
                max={max}
                onChange={(value) => {
                  if (rules.shared) {
                    const group = rooms[0] ?? { adults: 0, children: 0, infants: 0 };
                    const change = value - count;
                    const next =
                      change > 0
                        ? { ...group, adults: group.adults + change }
                        : group.children > 0 && group.adults > 0
                          ? { ...group, children: group.children - 1 }
                          : { ...group, adults: group.adults - 1 };
                    setRooms(offer, value === 0 ? [] : [next]);
                  } else {
                    setRooms(
                      offer,
                      value > rooms.length
                        ? [...rooms, { adults: 1, children: 0, infants: 0 }]
                        : rooms.slice(0, value),
                    );
                  }
                }}
                data-testid="stay-mix-rooms"
              />
              {rooms.length > 0 && (
                <div className="flex flex-col gap-3 border-t border-line pt-3">
                  {rooms.map((room, index) => (
                    <RoomBlock
                      key={index}
                      room={room}
                      title={rules.shared ? null : `Room ${index + 1}`}
                      rules={rules}
                      kinds={kinds}
                      onChange={(next) => setRooms(offer, rooms.map((each, i) => (i === index ? next : each)))}
                      testId="stay-mix"
                    />
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {allRooms.length > 0 && (
        <div className="flex flex-col gap-2 rounded-card bg-surface-2 p-3" data-testid="stay-mix-summary">
          <CoverBar
            people={guests}
            covered={placed}
            summary={mixSummary(picked, picks, shownPets)}
            need="a bed"
            done="Everyone has a bed"
            data-testid="stay-mix-cover"
          />
          {petHost && (searched.pets > 0 || shownPets > 0) && (
            <StepperField
              label="Pets"
              hint={`${petHost.title} only${petHost.rules.pets ? ` · up to ${petHost.rules.pets}` : ""}`}
              value={shownPets}
              max={petMax}
              onChange={setPets}
              data-testid="stay-mix-pets"
            />
          )}
          <dl className="flex flex-col gap-1 border-t border-line pt-2 text-sm tabular-nums">
            {results.flatMap((result, i) => {
              if (!result || !("quote" in result)) return [];
              const offer = picked[i];
              const rooms = result.quote.rooms;
              const lines = rooms.map((room, n) => (
                <div key={`${offer.listingId}-${n}`} className="flex justify-between gap-3">
                  <dt>
                    {offer.title}
                    {rooms.length > 1 ? ` ${n + 1}` : ""} · {roomText(room)}
                    {room.extra_guests > 0 ? ` · ${room.extra_guests} extra` : ""}
                  </dt>
                  <dd>{formatPeso(room.total_cents)}</dd>
                </div>
              ));
              const petLines = result.quote.fees
                .filter((fee) => fee.charged_per === "pet" || fee.charged_per === "pet_night")
                .map((fee) => (
                  <div key={`${offer.listingId}-fee-${fee.id}`} className="flex justify-between gap-3">
                    <dt>{fee.name}</dt>
                    <dd>{formatPeso(fee.total_cents)}</dd>
                  </div>
                ));
              return [...lines, ...petLines];
            })}
            {total !== null && (
              <div className="flex justify-between gap-3 border-t border-line pt-2 font-semibold">
                <dt>Total</dt>
                <dd data-testid="stay-mix-total">{formatPeso(total)}</dd>
              </div>
            )}
          </dl>
          {errors.length > 0 && (
            <ul role="alert" className="flex flex-col gap-1 text-sm text-danger">
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          )}
          <Button
            type="button"
            glyph="plus"
            disabled={errors.length > 0 || !priced}
            loading={busy}
            onClick={addAll}
            data-testid="stay-mix-add"
          >
            {busy ? "Adding…" : picked.length > 1 ? `Add ${picked.length} stays to trip` : "Add to trip"}
          </Button>
        </div>
      )}
    </section>
  );
}
