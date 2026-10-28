"use client";

import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatPeso } from "@/lib/money";
import { useListingPrices } from "./use-listing-price";
import type { TripItem } from "./use-trips";

type Entry = { kind: "item"; item: TripItem } | { kind: "shop"; business: TripItem["business"]; items: TripItem[] };

// A list of a trip's items with one shop's vehicles together (RAA-191, the plan's mock 3): the
// rental vehicles of a business that has two or more in the list sit under its name, where its
// first one was; everything else keeps its place.
export function byShop(items: TripItem[]): Entry[] {
  const vehicles = new Map<number, TripItem[]>();
  for (const item of items) {
    if (item.units) vehicles.set(item.business.id, [...(vehicles.get(item.business.id) ?? []), item]);
  }
  const entries: Entry[] = [];
  const placed = new Set<number>();
  for (const item of items) {
    const shop = item.units ? vehicles.get(item.business.id) : undefined;
    if (!shop || shop.length < 2) entries.push({ kind: "item", item });
    else if (!placed.has(item.business.id)) {
      placed.add(item.business.id);
      entries.push({ kind: "shop", business: item.business, items: shop });
    }
  }
  return entries;
}

// One shop's vehicles in a trip: its name and how many bookings they are (the shop answers each
// model on its own), the item cards, each model's price lines from the API and the shop's
// subtotal, the refundable deposits apart, and how many of the trip's people still have no seat.
export function ShopGroup({
  business,
  items,
  people,
  card,
}: {
  business: TripItem["business"];
  items: TripItem[];
  people: number;
  card: (item: TripItem) => ReactNode;
}) {
  // Each model priced by the API as checkout will charge it (RAA-191), the deposit apart.
  const prices = useListingPrices(
    items.map((item) => ({
      listingId: item.listing.id,
      startsOn: item.starts_on ?? undefined,
      endsOn: item.ends_on ?? undefined,
      quantity: item.quantity,
      units: item.units ?? undefined,
    })),
  );
  // A model that can't be had on its dates (its card says why) is left out of the sums, as the
  // trip's total leaves it out.
  const lines = items.map((item, index) => {
    const price = prices[index]?.data;
    return { item, price: price && !price.unavailable && !item.unavailable ? price : undefined };
  });
  const counted = lines.filter((line) => line.price);
  const loaded = prices.every((result) => !result.isPending);
  const subtotal = loaded && counted.length > 0 ? counted.reduce((sum, line) => sum + (line.price?.total_cents ?? 0), 0) : null;
  const deposit = counted.reduce((sum, line) => sum + (line.price?.deposit_cents ?? 0), 0);
  const seats = counted.reduce((sum, { item }) => sum + (item.units ?? 0) * (item.seats ?? 1), 0);
  const short = people - seats;

  return (
    <li data-testid="cart-shop">
      <Card edge="line" className="flex flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-line bg-surface-2 px-4 py-2.5">
          <span className="font-semibold">{business.name}</span>
          <Badge tone="kind">
            {items.length} {items.length === 1 ? "booking" : "bookings"}
          </Badge>
        </div>
        <ul className="flex flex-col gap-2 p-2.5">
          {lines.map(({ item, price }) => (
            <li key={item.id} className="flex flex-col gap-1">
              <ul>{card(item)}</ul>
              {price?.lines.map((line) => (
                <p key={line.label} className="flex justify-between gap-3 px-2 text-sm" data-testid="cart-shop-line">
                  <span className="text-muted">{line.label}</span>
                  <span className="font-semibold tabular-nums">{formatPeso(line.amount_cents)}</span>
                </p>
              ))}
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-1 border-t border-line px-4 py-2.5 text-sm">
          {subtotal !== null && (
            <p className="flex justify-between gap-3 font-semibold">
              <span>Shop subtotal</span>
              <span className="tabular-nums" data-testid="cart-shop-subtotal">
                {formatPeso(subtotal)}
              </span>
            </p>
          )}
          {deposit > 0 && (
            <p className="flex justify-between gap-3 text-muted">
              <span>Refundable deposits, held at pick-up</span>
              <span className="tabular-nums">{formatPeso(deposit)}</span>
            </p>
          )}
          {loaded && short > 0 && (
            <p className="text-warning" data-testid="cart-shop-short">
              {short} of your {people} people still need a ride.
            </p>
          )}
          <p className="text-muted">The shop accepts or declines each model separately.</p>
        </div>
      </Card>
    </li>
  );
}
