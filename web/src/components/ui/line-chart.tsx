"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { cn } from "./cn";

export type LinePoint = { date: string; value: number };

const HEIGHT = 240;
const TOP = 12;
const RIGHT = 12;
const BOTTOM = 28;
const TICKS = 4;
// Wide enough for "Nov 30" with room between labels.
const X_LABEL_ROOM = 64;

const DAY = new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", timeZone: "UTC" });
const LONG_DAY = new Intl.DateTimeFormat("en-PH", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

// "2026-11-03" is a calendar day, not an instant: read it in UTC so no time zone moves it.
function day(date: string, format = DAY) {
  return format.format(new Date(`${date}T00:00:00Z`));
}

// A round top for the Y axis and its step: 0, 5, 10, 15, 20 rather than 0, 4.6, 9.2…
// Whole steps only when the values are whole (counts, centavos).
function niceScale(max: number, integer: boolean) {
  if (max <= 0) return { top: TICKS, step: 1 };
  const raw = max / TICKS;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / magnitude;
  let step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * magnitude;
  if (integer) step = Math.max(1, Math.ceil(step));
  return { top: step * Math.ceil(max / step), step };
}

// The width of the box the chart is in, so the SVG draws at its real size: text and the 2px
// line keep their size on a phone instead of shrinking with a viewBox.
function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return { ref, width };
}

// One series over days (RAA-289): a 2px line in the action colour over a faint wash, round Y
// ticks, the days along the foot thinned to fit, and a crosshair that snaps to the nearest day
// with its value — by pointer, touch, or the arrow keys once focused. Single series, so no
// legend: `label` names it. The values are also in a table for screen readers.
export function LineChart({
  data,
  label,
  format = (value) => value.toLocaleString("en-PH"),
  axisFormat = format,
  className,
  "data-testid": testId,
}: {
  data: LinePoint[];
  label: string;
  format?: (value: number) => string;
  // The Y axis's labels, when they should be shorter than the readout's (₱12K for ₱12,000).
  axisFormat?: (value: number) => string;
  className?: string;
  "data-testid"?: string;
}) {
  const { ref, width } = useWidth();
  const [active, setActive] = useState<number | null>(null);
  
  const values = data.map((point) => point.value);
  const integer = values.every(Number.isInteger);
  const { top, step } = niceScale(Math.max(0, ...values), integer);
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  // Room for the longest Y label (about 7px a character at 12px).
  const left = Math.max(...ticks.map((tick) => axisFormat(tick).length)) * 7 + 12;
  const plotWidth = Math.max(0, width - left - RIGHT);
  const plotHeight = HEIGHT - TOP - BOTTOM;
  const stepX = data.length > 1 ? plotWidth / (data.length - 1) : 0;
  const x = (i: number) => left + (data.length > 1 ? i * stepX : plotWidth / 2);
  const y = (value: number) => TOP + plotHeight - (value / top) * plotHeight;

  const line = data.map((point, i) => `${i ? "L" : "M"}${x(i)},${y(point.value)}`).join("");
  const area = data.length ? `${line}L${x(data.length - 1)},${y(0)}L${x(0)},${y(0)}Z` : "";
  // Label every nth day, counted back from today so the last day is always named.
  const every = Math.max(1, Math.ceil(data.length / Math.max(1, Math.floor(plotWidth / X_LABEL_ROOM))));
  const xLabels = data.map((_, i) => i).filter((i) => (data.length - 1 - i) % every === 0);

  function pick(event: PointerEvent<SVGRectElement>) {
    if (!data.length) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const offset = event.clientX - bounds.left;
    setActive(Math.min(data.length - 1, Math.max(0, Math.round(stepX ? offset / stepX : 0))));
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!data.length) return;
    const last = data.length - 1;
    const now = active ?? last;
    const next = { ArrowLeft: now - 1, ArrowRight: now + 1, Home: 0, End: last }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    setActive(Math.min(last, Math.max(0, next)));
  }

  const point = active === null ? null : data[active];
  // The readout sits beside the crosshair, flipping to its left past the middle.
  const readoutLeft = active === null ? 0 : x(active);
  const flip = readoutLeft > width / 2;

  return (
    <div
      ref={ref}
      tabIndex={0}
      role="group"
      aria-label={`${label}. Use the arrow keys to read each day.`}
      onKeyDown={onKeyDown}
      onFocus={() => setActive((current) => current ?? (data.length ? data.length - 1 : null))}
      onBlur={() => setActive(null)}
      data-testid={testId}
      className={cn("relative w-full rounded-control outline-none focus-visible:ring-4 focus-visible:ring-sky-mist", className)}
      style={{ height: HEIGHT }}
    >
      {width > 0 && (
        <svg width={width} height={HEIGHT} aria-hidden className="block overflow-visible">
          {ticks.map((tick) => (
            <g key={tick}>
              <line x1={left} x2={left + plotWidth} y1={y(tick)} y2={y(tick)} className="stroke-line" strokeWidth={1} />
              <text x={left - 8} y={y(tick)} dy="0.32em" textAnchor="end" className="fill-muted text-xs tabular-nums">
                {axisFormat(tick)}
              </text>
            </g>
          ))}
          {xLabels.map((i) => (
            <text
              key={data[i].date}
              x={x(i)}
              y={HEIGHT - 8}
              textAnchor={i === 0 && xLabels.length > 1 ? "start" : i === data.length - 1 ? "end" : "middle"}
              className="fill-muted text-xs"
            >
              {day(data[i].date)}
            </text>
          ))}
          <path d={area} className="fill-primary/10" />
          <path d={line} fill="none" className="stroke-primary" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {data.length > 0 && active === null && (
            <circle cx={x(data.length - 1)} cy={y(data[data.length - 1].value)} r={4} className="fill-primary stroke-surface" strokeWidth={2} />
          )}
          {point && active !== null && (
            <g>
              <line x1={x(active)} x2={x(active)} y1={TOP} y2={TOP + plotHeight} className="stroke-muted" strokeWidth={1} />
              <circle cx={x(active)} cy={y(point.value)} r={5} className="fill-primary stroke-surface" strokeWidth={2} />
            </g>
          )}
          {/* The hit area: the whole plot, so a pointer finds a day without aiming at the line. */}
          <rect
            x={left}
            y={0}
            width={plotWidth}
            height={TOP + plotHeight}
            fill="transparent"
            onPointerMove={pick}
            onPointerDown={pick}
            onPointerLeave={() => setActive(null)}
          />
        </svg>
      )}

      {point && (
        <div
          aria-hidden
          className="pointer-events-none absolute top-0 rounded-control border border-line bg-surface px-3 py-2 shadow-lift"
          style={flip ? { right: width - readoutLeft + 12 } : { left: readoutLeft + 12 }}
        >
          <p className="text-base font-semibold whitespace-nowrap tabular-nums">{format(point.value)}</p>
          <p className="text-xs whitespace-nowrap text-muted">{day(point.date, LONG_DAY)}</p>
        </div>
      )}

      {/* What the arrow keys step through, announced as it moves. */}
      <p aria-live="polite" className="sr-only">
        {point ? `${day(point.date, LONG_DAY)}: ${format(point.value)}` : ""}
      </p>
      <table className="sr-only">
        <caption>{label}</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">Value</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.date}>
              <td>{day(row.date, LONG_DAY)}</td>
              <td>{format(row.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
