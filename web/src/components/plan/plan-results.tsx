"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronGlyph, ListGlyph } from "@/components/discovery/tag-glyphs";
import { cn } from "@/components/ui/cn";
import { formatPeso } from "@/lib/money";
import { PlanCard, type CardContext } from "./plan-card";
import type { PlanBusiness } from "./plan-data";
import type { ResultPin } from "./results-map";

const ResultsMap = dynamic(() => import("./results-map"), {
  ssr: false,
  loading: () => <div aria-hidden className="size-full bg-sky-mist motion-safe:animate-pulse" />,
});

// `count`: how many the group has on every page, for its heading.
export type ResultGroup = { title?: string; businesses: PlanBusiness[]; count?: number };
type Stay = { point: { lat: number; lng: number }; name: string } | null;

// A pin per business, at its first listing's rounded point, with its lowest price.
function pinsOf(businesses: PlanBusiness[]): ResultPin[] {
  return businesses.map((business) => {
    const label = business.price_from_cents ? formatPeso(business.price_from_cents) : "Ask";
    return { id: business.id, point: business.location, label, name: `${business.name}, ${business.price_from_cents ? `from ${label}` : "price to be agreed"}` };
  });
}

// A step's options beside their map, in the step itself (2026-11-03, from lg; a phone has the
// map view, PlanMapView), one page at a time: the page's cards fill the left in a grid with the
// pager under them, and the map of the page's pins sticks on the right under the header, above
// the page's foot, while they scroll; a card under the pointer lights its pin. A tapped pin shows
// its option's card over the map, which opens it. `busy`: the next page is loading (cards dim).
export function PlanResults({
  groups,
  context,
  stay,
  hrefOf,
  pager,
  busy,
  onHide,
}: {
  groups: ResultGroup[];
  context: CardContext;
  stay: Stay;
  // A business's page, which its card opens.
  hrefOf: (id: number) => string;
  pager?: ReactNode;
  busy?: boolean;
  // Hide map, over the map's corner.
  onHide: () => void;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const businesses = groups.flatMap((group) => group.businesses);
  const chosen = businesses.find((business) => business.id === picked) ?? null;

  return (
    <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(20rem,42%)] lg:items-start" data-testid="plan-results">
      <div className={cn("@container flex min-w-0 flex-col gap-8 transition-opacity duration-300 ease-calm", busy && "opacity-60")} aria-busy={busy || undefined}>
        {groups.map((group, index) =>
          group.businesses.length === 0 ? null : (
            <section key={group.title ?? index} className="flex flex-col gap-4">
              {group.title && (
                <h3 className="flex items-baseline gap-2 font-display text-lg font-extrabold tracking-tight text-navy">
                  {group.title}
                  <span className="text-sm font-medium text-muted tabular-nums">{group.count ?? group.businesses.length}</span>
                </h3>
              )}
              <div className="grid grid-cols-1 gap-x-5 gap-y-8 @md:grid-cols-2 @2xl:grid-cols-3">
                {group.businesses.map((business) => (
                  <PlanCard
                    key={business.id}
                    business={business}
                    href={hrefOf(business.id)}
                    context={context}
                    onHover={setHovered}
                    active={business.id === picked}
                  />
                ))}
              </div>
            </section>
          ),
        )}
        {pager}
      </div>

      {/* Stuck under the header, above the step's foot (PlanFoot). */}
      <div className="sticky top-(--plan-chrome) hidden h-[calc(100dvh-var(--plan-chrome)-9rem)] min-h-80 lg:block" data-testid="plan-results-map-pane">
        <div className="relative size-full overflow-hidden rounded-card bg-sky-mist card-edge shadow-soft">
          <ResultsMap pins={pinsOf(businesses)} stay={stay} active={hovered ?? picked} onPick={setPicked} onHide={onHide} />
          {chosen && (
            <PlanCard
              business={chosen}
              href={hrefOf(chosen.id)}
              context={context}
              onClose={() => setPicked(null)}
              className="absolute bottom-4 left-4 z-10 w-80"
            />
          )}
        </div>
      </div>
    </div>
  );
}

// A step's map view below lg (Airbnb's on a phone): the map over the whole screen with the price
// pins of the page shown, the way back and the step's name with which of its options they are at
// the top, and a List pill at the foot, between ‹ and › for the pages before and after. A tapped
// pin shows its option's card at the foot in their place, photos to swipe, which opens it.
export function PlanMapView({
  title,
  businesses,
  total,
  page,
  perPage,
  onPage,
  context,
  stay,
  hrefOf,
  onClose,
}: {
  title: string;
  businesses: PlanBusiness[];
  total: number;
  page: number;
  perPage: number;
  onPage: (page: number) => void;
  context: CardContext;
  stay: Stay;
  hrefOf: (id: number) => string;
  onClose: () => void;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const chosen = businesses.find((business) => business.id === picked) ?? null;

  const rootRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);

  // A modal over the page: the page under it stays put and leaves the tab order (inert), focus
  // starts on the way back and returns to the Map pill; Escape goes back to the list.
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const hidden = [...document.body.children].filter(
      (element): element is HTMLElement => element instanceof HTMLElement && element !== rootRef.current && !element.inert,
    );
    hidden.forEach((element) => (element.inert = true));
    backRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !document.querySelector("dialog[open]")) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      hidden.forEach((element) => (element.inert = false));
      window.removeEventListener("keydown", onKey);
      opener?.focus();
    };
  }, [onClose]);

  const noun = total === 1 ? "business" : "businesses";
  const pages = Math.ceil(total / perPage);
  return createPortal(
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label={`${title} on the map`}
      className="fixed inset-0 z-50 bg-sky-mist"
      data-testid="plan-map-view"
    >
      {/* Fitted above the foot, where a tapped pin's card shows, so the pins stay in reach. */}
      <ResultsMap pins={pinsOf(businesses)} stay={stay} active={picked} onPick={setPicked} covered={0.42} />
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button
          ref={backRef}
          type="button"
          onClick={onClose}
          aria-label="Back to the list"
          className="pointer-events-auto flex size-11 shrink-0 items-center justify-center rounded-full bg-surface text-navy shadow-float"
        >
          <ChevronGlyph direction="left" className="size-5" />
        </button>
        <p className="pointer-events-auto min-w-0 truncate rounded-full bg-surface px-4 py-2.5 text-sm font-bold text-navy shadow-float">
          {title} · {pages > 1 ? rangeText(page, perPage, total) : `${total} ${noun}`}
        </p>
      </div>
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center p-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        {chosen ? (
          <PlanCard
            key={chosen.id}
            business={chosen}
            href={hrefOf(chosen.id)}
            context={context}
            onClose={() => setPicked(null)}
            onLeave={onClose}
            className="w-full max-w-md"
          />
        ) : (
          <div className="flex items-center gap-2">
            {pages > 1 && (
              <PageArrow direction="left" disabled={page <= 1} onClick={() => onPage(page - 1)} className="bg-surface text-navy shadow-float" />
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex min-h-11 items-center gap-2 rounded-full bg-navy px-5 text-sm font-semibold text-white shadow-float"
              data-testid="plan-map-list"
            >
              List
              <ListGlyph className="size-4" />
            </button>
            {pages > 1 && (
              <PageArrow direction="right" disabled={page >= pages} onClick={() => onPage(page + 1)} className="bg-surface text-navy shadow-float" />
            )}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

// "19–36 of 47".
export function rangeText(page: number, perPage: number, total: number) {
  return `${(page - 1) * perPage + 1}–${Math.min(page * perPage, total)} of ${total}`;
}

function PageArrow({ direction, disabled, onClick, className }: { direction: "left" | "right"; disabled: boolean; onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={direction === "left" ? "Previous page" : "Next page"}
      className={cn("flex size-11 shrink-0 items-center justify-center rounded-full disabled:opacity-40", className)}
      data-testid={`plan-page-${direction === "left" ? "prev" : "next"}`}
    >
      <ChevronGlyph direction={direction} className="size-5" />
    </button>
  );
}

// The pages a pager offers: the first, the last, and the current one with its neighbours, with a
// gap (null) where pages are skipped: 1 … 4 5 6 … 12.
function pageList(page: number, pages: number): (number | null)[] {
  const wanted = new Set([1, pages, page - 1, page, page + 1].filter((each) => each >= 1 && each <= pages));
  const sorted = [...wanted].sort((a, b) => a - b);
  return sorted.flatMap((each, index) => (index > 0 && each - sorted[index - 1] > 1 ? [null, each] : [each]));
}

// Under a step's options, once they run past a page (Airbnb's): ‹ 1 2 3 … › and which of them
// show ("1–18 of 47"). Nothing while they fit on one.
export function PlanPager({ page, perPage, total, onPage }: { page: number; perPage: number; total: number; onPage: (page: number) => void }) {
  const pages = Math.ceil(total / perPage);
  if (pages <= 1) return null;
  return (
    <nav aria-label="Pages of options" className="flex flex-col items-center gap-2 pt-2" data-testid="plan-pager">
      <div className="flex items-center gap-1">
        <PageArrow direction="left" disabled={page <= 1} onClick={() => onPage(page - 1)} className="text-navy hover:bg-mist" />
        {pageList(page, pages).map((each, index) =>
          each === null ? (
            <span key={`gap-${index}`} aria-hidden className="w-6 text-center text-muted">
              …
            </span>
          ) : (
            <button
              key={each}
              type="button"
              onClick={() => onPage(each)}
              aria-current={each === page ? "page" : undefined}
              aria-label={`Page ${each}`}
              className={cn(
                "flex size-11 items-center justify-center rounded-full text-sm font-semibold tabular-nums transition-colors duration-300 ease-calm",
                each === page ? "bg-navy text-white" : "text-navy hover:bg-mist",
              )}
            >
              {each}
            </button>
          ),
        )}
        <PageArrow direction="right" disabled={page >= pages} onClick={() => onPage(page + 1)} className="text-navy hover:bg-mist" />
      </div>
      <p className="text-sm text-muted tabular-nums">{rangeText(page, perPage, total)}</p>
    </nav>
  );
}
