"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/components/ui/cn";
import { CategoryGlyph, GridGlyph } from "./tag-glyphs";

export type ListingGroup = { id: string; title: string; icon: string; count: number; content: ReactNode };

// What to book on an area page (RAA-125): a filter beside the listings. From lg it is a rail
// on the left that stays in view, the trip dates over the trip needs with their counts; on a
// phone the dates come first, then the needs as a row of chips that scrolls sideways. "All"
// shows every group under its heading; a need shows just its own. The rows are rendered on the
// server and passed in, so only the choice lives here.
export function ListingBrowser({ groups, dates, empty }: { groups: ListingGroup[]; dates: ReactNode; empty: ReactNode }) {
  const [current, setCurrent] = useState<string>("all");
  const total = groups.reduce((sum, group) => sum + group.count, 0);
  const options = [{ id: "all", title: "All", icon: "", count: total }, ...groups];
  const shown = current === "all" ? groups : groups.filter((group) => group.id === current);

  return (
    <div className="grid gap-5 lg:grid-cols-[16rem_minmax(0,1fr)] lg:items-start lg:gap-6">
      <aside aria-label="Filter what to book" className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-20">
        {dates}
        {groups.length > 1 && (
          <div
            role="group"
            aria-label="Show"
            className="-mx-1 flex gap-1.5 overflow-x-auto px-1 py-0.5 [scrollbar-width:none] lg:mx-0 lg:flex-col lg:gap-1 lg:overflow-visible lg:rounded-card lg:bg-surface lg:p-2 lg:card-edge lg:shadow-soft"
          >
            {options.map((option) => {
              const on = option.id === current;
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setCurrent(option.id)}
                  className={cn(
                    "flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold whitespace-nowrap transition-colors duration-300 ease-calm",
                    // In the rail: a row with the count in its own right-aligned column, and a long
                    // name wrapping beside its icon rather than pushing the count out.
                    "lg:grid lg:grid-cols-[1.75rem_minmax(0,1fr)_2.5ch] lg:gap-2.5 lg:rounded-control lg:border-0 lg:px-2.5 lg:py-2 lg:text-left lg:whitespace-normal",
                    on
                      ? "border-navy bg-navy text-white lg:bg-mist lg:text-primary"
                      : "border-line bg-surface text-foreground hover:border-line-strong lg:hover:bg-surface-2",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "hidden size-7 items-center justify-center rounded-lg lg:flex",
                      on ? "bg-surface text-primary" : "bg-mist text-primary",
                    )}
                  >
                    {option.icon ? <CategoryGlyph name={option.icon} className="size-4" /> : <GridGlyph className="size-4" />}
                  </span>
                  <span>{option.title}</span>
                  <span className={cn("tabular-nums lg:text-right", on ? "lg:text-primary" : "text-muted")}>{option.count}</span>
                </button>
              );
            })}
          </div>
        )}
      </aside>
      <div className="flex min-w-0 flex-col gap-8">
        {shown.length === 0
          ? empty
          : shown.map((group) => (
              <div key={group.id} className="flex flex-col gap-3">
                {(current === "all" || groups.length === 1) && (
                  <h3 id={group.id} className="scroll-mt-36 text-lg font-semibold">
                    {group.title}
                  </h3>
                )}
                {group.content}
              </div>
            ))}
      </div>
    </div>
  );
}
