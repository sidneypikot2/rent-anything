"use client";

import { useEffect, useRef, useState } from "react";
import { ListingCard } from "@/components/discovery/cards";
import { ChevronGlyph } from "@/components/discovery/tag-glyphs";
import { cn } from "@/components/ui/cn";

export type RowCard = {
  // Unique within a row: the group and the business (`stay-12`).
  id: string;
  href: string;
  title: string;
  category: string;
  note: string;
  photo?: { src: string; alt: string };
  price?: { prefix: string; amount: string; unit?: string };
  unpriced?: string;
  instantBook: boolean;
  // Its cancellation terms when they are a trust point ("Free cancellation"), as What to book's rows say.
  trust?: string;
  // Its booking group, for its icon's hue, where a row mixes them (transfers and rentals).
  kind?: string;
};

// A section's listings as a row of cards (the Klook-style hotel row), for Where to stay, Things
// to do and Getting around: it scrolls sideways, a card snapping to the start, and from sm a round button at each end
// steps it a screen at a time.
export function ListingRow({
  cards,
  kind,
  noun,
  testId,
}: {
  cards: RowCard[];
  kind: "stay" | "activity" | "transfer" | "rental";
  // For the buttons' names: "Earlier stays", "More stays".
  noun: string;
  testId: string;
}) {
  const row = useRef<HTMLUListElement>(null);
  const [ends, setEnds] = useState({ start: true, end: true });

  useEffect(() => {
    const list = row.current;
    if (!list) return;
    const update = () =>
      setEnds({ start: list.scrollLeft <= 1, end: list.scrollLeft + list.clientWidth >= list.scrollWidth - 1 });
    update();
    list.addEventListener("scroll", update, { passive: true });
    const resize = new ResizeObserver(update);
    resize.observe(list);
    return () => {
      list.removeEventListener("scroll", update);
      resize.disconnect();
    };
  }, []);

  const step = (direction: 1 | -1) => {
    const list = row.current;
    if (list) list.scrollBy({ left: direction * list.clientWidth * 0.9, behavior: "smooth" });
  };

  return (
    <div className="relative">
      <ul
        ref={row}
        data-testid={testId}
        className="-mx-inset flex snap-x snap-mandatory gap-3.5 overflow-x-auto overscroll-x-contain scroll-px-inset px-inset pb-1 [scrollbar-width:none] sm:mx-0 sm:scroll-px-0 sm:px-0"
      >
        {cards.map((card) => (
          <li key={card.id} className="@container w-72 shrink-0 snap-start sm:w-[calc((100%-1.75rem)/2.2)] lg:w-[calc((100%-2.625rem)/3.3)]">
            <ListingCard
              href={card.href}
              title={card.title}
              category={card.category}
              kind={card.kind ?? kind}
              note={card.note}
              photo={card.photo}
              sizes="(min-width: 64rem) 22rem, 18rem"
              price={card.price}
              unpriced={card.unpriced}
              stacked
              instantBook={card.instantBook}
              trust={card.trust}
            />
          </li>
        ))}
      </ul>
      {(["start", "end"] as const).map((side) => (
        <button
          key={side}
          type="button"
          aria-label={side === "start" ? `Earlier ${noun}` : `More ${noun}`}
          onClick={() => step(side === "start" ? -1 : 1)}
          className={cn(
            "absolute top-24 z-20 flex size-11 items-center justify-center rounded-full border border-line bg-white text-foreground shadow-md transition-opacity max-sm:hidden",
            side === "start" ? "-left-5" : "-right-5",
            ends[side] && "pointer-events-none opacity-0",
          )}
        >
          <ChevronGlyph direction={side === "start" ? "left" : "right"} className="size-5" />
        </button>
      ))}
    </div>
  );
}
