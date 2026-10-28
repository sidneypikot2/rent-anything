"use client";

import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatPeso } from "@/lib/money";
import { useShopListings } from "./use-shop-listings";
import { rentalDays } from "./vehicle-party";
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
// model on its own), the item cards, an estimate per model from its rate (rent for each vehicle and
// day, plus the refundable deposit) and the shop's subtotal, and how many of the trip's people
// still have no seat. Prices are estimates until rentals are priced at checkout.
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
  const first = items.find((item) => item.starts_on && item.ends_on);
  const shop = useShopListings(business.id, "", first?.starts_on ?? undefined, first?.ends_on ?? undefined);
  const rates = new Map((shop.data?.listings ?? []).map((listing) => [listing.id, listing.vehicle_rate]));
  const lines = items.map((item) => {
    const rate = rates.get(item.listing.id);
    const units = item.units ?? 1;
    const days = rentalDays(item.starts_on ?? undefined, item.ends_on ?? undefined);
    const total = rate ? units * (rate.daily_price_cents * days + (rate.security_deposit_cents ?? 0)) : null;
    return { item, rate, units, days, total };
  });
  const subtotal = lines.every((line) => line.total !== null) ? lines.reduce((sum, line) => sum + (line.total ?? 0), 0) : null;
  const seats = items.reduce((sum, item) => sum + (item.units ?? 0) * (item.seats ?? 1), 0);
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
          {lines.map(({ item, rate, units, days, total }) => (
            <li key={item.id} className="flex flex-col gap-1">
              <ul>{card(item)}</ul>
              {rate && total !== null && (
                <p className="flex justify-between gap-3 px-2 text-sm" data-testid="cart-shop-line">
                  <span className="text-muted">
                    {formatPeso(rate.daily_price_cents)} × {units} × {days} {days === 1 ? "day" : "days"} + deposit
                  </span>
                  <span className="font-semibold tabular-nums">{formatPeso(total)}</span>
                </p>
              )}
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
          {short > 0 && (
            <p className="text-warning" data-testid="cart-shop-short">
              {short} of your {people} people still need a ride.
            </p>
          )}
          <p className="text-muted">The shop accepts or declines each model separately. Prices are an estimate until the partner confirms them.</p>
        </div>
      </Card>
    </li>
  );
}
