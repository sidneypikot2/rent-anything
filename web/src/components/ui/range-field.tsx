"use client";

import { useId, useState, type KeyboardEvent } from "react";
import { cn } from "./cn";
import { controlClasses } from "./field-look";

// An end left where it starts is no limit (null).
export type RangeValue = [number | null, number | null];

type Props = {
  legend: string;
  // Words after the legend, quieter ("/ night").
  aside?: string;
  min: number;
  max: number;
  // The real lowest value when `min` was rounded down below it (a ₱22 price on a ₱50 grid from
  // ₱0): shown in its place, so the range never offers a value nobody has.
  lowest?: number;
  step: number;
  value: RangeValue;
  onChange: (next: RangeValue) => void;
  // A number as shown in the boxes and read out ("₱1,200").
  format: (value: number) => string;
  // What each thumb is called for a screen reader.
  labels?: [string, string];
  "data-testid"?: string;
};

const THUMB = [
  "[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:size-7 [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:appearance-none",
  "[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-primary [&::-webkit-slider-thumb]:bg-surface [&::-webkit-slider-thumb]:shadow-soft",
  "[&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:size-7 [&::-moz-range-thumb]:cursor-grab [&::-moz-range-thumb]:appearance-none",
  "[&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-primary [&::-moz-range-thumb]:bg-surface [&::-moz-range-thumb]:shadow-soft",
  "focus-visible:[&::-webkit-slider-thumb]:ring-4 focus-visible:[&::-webkit-slider-thumb]:ring-sky-mist",
  "focus-visible:[&::-moz-range-thumb]:ring-4 focus-visible:[&::-moz-range-thumb]:ring-sky-mist",
].join(" ");

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

// A range picked with two thumbs on one track (two native range inputs laid over each other, so
// keyboard and screen readers work as for any slider), and under it the two ends in boxes that
// can be typed in. While a thumb is dragged the value is held here and given on release, so a
// count asked for each change isn't asked at every step. A thumb at its end sets no limit.
export function RangeField({ legend, aside, min, max, step, value, onChange, format, labels = ["Lowest", "Highest"], lowest, ...rest }: Props) {
  const [drag, setDrag] = useState<[number, number] | null>(null);
  const [front, setFront] = useState<0 | 1>(1);
  const span = Math.max(max - min, step);
  const given: [number, number] = [clamp(value[0] ?? min, min, max), clamp(value[1] ?? max, min, max)];
  const [low, high] = drag ?? given;
  const floor = Math.max(min, lowest ?? min);
  const shown = (each: number) => format(Math.max(each, floor));

  const commit = (next: [number, number]) => {
    setDrag(null);
    const [a, b] = next[0] <= next[1] ? next : [next[1], next[0]];
    onChange([a <= floor ? null : a, b >= max ? null : b]);
  };
  const release = () => drag && commit(drag);
  const move = (end: 0 | 1, raw: number) => {
    const next: [number, number] = end === 0 ? [Math.min(raw, high), high] : [low, Math.max(raw, low)];
    setDrag(next);
  };
  const percent = (each: number) => ((each - min) / span) * 100;

  const thumb = (end: 0 | 1) => (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={end === 0 ? low : high}
      aria-label={labels[end]}
      aria-valuetext={shown(end === 0 ? low : high)}
      onPointerDown={() => setFront(end)}
      onFocus={() => setFront(end)}
      onChange={(event) => move(end, Number(event.currentTarget.value))}
      onPointerUp={release}
      onKeyUp={release}
      onBlur={release}
      className={cn("pointer-events-none absolute inset-0 h-11 w-full appearance-none bg-transparent outline-none", THUMB, front === end ? "z-20" : "z-10")}
    />
  );

  return (
    <fieldset className="flex flex-col gap-3" data-testid={rest["data-testid"]}>
      <legend className="mb-1 text-sm font-semibold">
        {legend}
        {aside && <span className="font-normal text-muted"> {aside}</span>}
      </legend>
      <div className="relative h-11 px-3.5">
        <div className="relative h-full">
          <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-line" />
          <div
            className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-primary"
            style={{ left: `${percent(low)}%`, right: `${100 - percent(high)}%` }}
          />
        </div>
        <div className="absolute inset-0">
          {thumb(0)}
          {thumb(1)}
        </div>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
        <RangeBox label="Min" value={Math.max(low, floor)} shown={shown(low)} onCommit={(typed) => commit([clamp(typed, min, high), high])} />
        <span aria-hidden className="pb-3 text-muted">
          –
        </span>
        <RangeBox
          label="Max"
          value={Math.max(high, floor)}
          shown={high >= max ? `${shown(high)}+` : shown(high)}
          onCommit={(typed) => commit([low, clamp(typed, low, max)])}
        />
      </div>
    </fieldset>
  );
}

// One end as a box: it shows the formatted value, and while focused the plain number to edit,
// given on Enter or on leaving it.
function RangeBox({ label, value, shown, onCommit }: { label: string; value: number; shown: string; onCommit: (typed: number) => void }) {
  const id = useId();
  const [text, setText] = useState<string | null>(null);
  const done = () => {
    if (text === null) return;
    const typed = Number(text.replace(/[^\d.]/g, ""));
    setText(null);
    if (text.trim() !== "" && Number.isFinite(typed)) onCommit(Math.floor(typed));
  };
  return (
    <div className="flex flex-col gap-1 text-small font-semibold">
      <label htmlFor={id} className="text-muted">
        {label}
      </label>
      <input
        id={id}
        inputMode="numeric"
        value={text ?? shown}
        onFocus={(event) => {
          setText(String(value));
          requestAnimationFrame(() => event.target.select());
        }}
        onChange={(event) => setText(event.currentTarget.value)}
        onBlur={done}
        onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => event.key === "Enter" && (event.preventDefault(), event.currentTarget.blur())}
        className={cn("w-full tabular-nums", controlClasses("stacked", undefined, true))}
      />
    </div>
  );
}
