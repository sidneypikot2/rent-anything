"use client";

import { useState } from "react";
import { cn } from "@/components/ui/cn";
import { LineChart } from "@/components/ui/line-chart";
import { Pill } from "@/components/ui/pill";
import { DisplayTitle } from "@/components/ui/typography";
import { formatPeso } from "@/lib/money";
import { useAdminOverview, type OverviewDays, type OverviewMetric } from "./use-admin-overview";

const RANGES: OverviewDays[] = [7, 30, 90];

const COMPACT_PESO = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", notation: "compact", maximumFractionDigits: 1 });
const count = (value: number) => value.toLocaleString("en-PH");
const peso = (cents: number) => formatPeso(cents);
// Whole pesos in full under ₱10,000, compact past it (₱12K), on the axis only.
const pesoAxis = (cents: number) => (cents < 1_000_000 ? formatPeso(Math.round(cents / 100) * 100) : COMPACT_PESO.format(cents / 100));

// What each figure means, said once under its name: the API's definitions (Admin::Overview).
const METRICS: { key: OverviewMetric; label: string; hint: string; money?: boolean }[] = [
  { key: "visitors", label: "Visitors", hint: "Unique browsers a day" },
  { key: "bookings", label: "Bookings", hint: "Booked or requested online" },
  { key: "booking_amount_cents", label: "Booking amount", hint: "Paid bookings' total", money: true },
  { key: "revenue_cents", label: "Revenue", hint: "Our commission on them", money: true },
];

// The admin console's first page (RAA-289, over RAA-290's API): the range's totals as four tiles,
// which also pick the figure the line graph shows day by day — one figure at a time, never two
// on one axis.
export function AdminOverview() {
  const [days, setDays] = useState<OverviewDays>(30);
  const [metric, setMetric] = useState<OverviewMetric>("visitors");
  const { data, isError, isFetching } = useAdminOverview(days);
  const shown = METRICS.find((m) => m.key === metric) ?? METRICS[0];

  return (
    <main data-testid="admin-overview" className="flex w-full min-w-0 flex-1 flex-col gap-block py-page-pad">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <DisplayTitle>Overview</DisplayTitle>
        <div role="group" aria-label="Range" className="flex gap-2" data-testid="admin-overview-range">
          {RANGES.map((range) => (
            <Pill key={range} on={days === range} onClick={() => setDays(range)} data-testid={`admin-overview-range-${range}`}>
              {range} days
            </Pill>
          ))}
        </div>
      </div>

      {isError && (
        <p role="alert" className="text-sm text-danger">
          The overview couldn&apos;t load. Refresh the page to try again.
        </p>
      )}

      <div role="group" aria-label="Show on the graph" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {METRICS.map(({ key, label, hint, money }) => {
          const value = data?.totals[key];
          const on = metric === key;
          return (
            <button
              key={key}
              type="button"
              aria-pressed={on}
              onClick={() => setMetric(key)}
              data-testid={`admin-overview-tile-${key}`}
              className={cn(
                "card-edge-line min-w-0 cursor-pointer rounded-card bg-surface p-4 text-left sm:p-5 shadow-soft transition-[box-shadow,border-color] duration-300 ease-calm hover:shadow-lift",
                on && "border-primary ring-2 ring-primary",
              )}
            >
              <p className={cn("text-sm font-semibold", on ? "text-primary" : "text-foreground")}>{label}</p>
              {value === undefined ? (
                <span className="mt-2 block h-8 w-20 animate-pulse rounded-control bg-mist" />
              ) : (
                <p className="mt-1 font-display text-xl font-bold break-words tabular-nums sm:text-3xl">{money ? peso(value) : count(value)}</p>
              )}
              <p className="mt-1 text-xs text-muted">{hint}</p>
            </button>
          );
        })}
      </div>

      <section aria-labelledby="overview-chart-title" className="card-edge-line rounded-card bg-surface p-4 shadow-soft sm:p-5">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2 id="overview-chart-title" className="text-lg font-semibold">
            {shown.label} per day
          </h2>
          <p className="text-sm text-muted">
            Last {days} days{isFetching && data ? " · updating…" : ""}
          </p>
        </div>
        {data ? (
          <LineChart
            key={metric}
            data={data.series.map((row) => ({ date: row.date, value: row[metric] }))}
            label={`${shown.label} per day, last ${days} days`}
            format={shown.money ? peso : count}
            axisFormat={shown.money ? pesoAxis : count}
            data-testid="admin-overview-chart"
          />
        ) : (
          <div className="h-60 animate-pulse rounded-control bg-mist" />
        )}
      </section>
    </main>
  );
}
