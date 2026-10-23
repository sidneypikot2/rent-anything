"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { useBesideMap } from "./area-map-context";

// Places a grid shows before its "See all N".
const FIRST_PLACES = 6;

// An area page's places to see: a row to swipe on a phone (every place, as a swipe costs no
// height) with "Show all N places" to list them down the page instead, and from sm a grid of the
// first six with "Show all N places" for the rest. A link to one of the rest (#kota-park: a search
// suggestion, a map pin's pop-up) opens the grid and scrolls to it, as a card folded away can't be
// scrolled to. `items` are the cards, each keyed by its anchor.
export function PlacesGrid({ items }: { items: { id: string; card: ReactNode }[] }) {
  const besideMap = useBesideMap();
  const [open, setOpen] = useState(false);
  const [reveal, setReveal] = useState<{ id: string } | null>(null);
  const folded = items.length > FIRST_PLACES && !open;

  useEffect(() => {
    const follow = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      const at = items.findIndex((item) => item.id === id);
      if (at < FIRST_PLACES) return;
      setOpen(true);
      setReveal({ id });
    };
    follow();
    window.addEventListener("hashchange", follow);
    return () => window.removeEventListener("hashchange", follow);
  }, [items]);
  useEffect(() => {
    if (reveal) document.getElementById(reveal.id)?.scrollIntoView({ block: "start" });
  }, [reveal]);

  return (
    <div className="flex flex-col gap-gutter">
      {/* Two to a row from sm, three from lg, and two beside the map; opened on a phone, one per row. */}
      <ul
        className={cn(
          "grid gap-3 sm:grid-cols-2 sm:gap-gutter",
          // The row's own padding above and below holds a card's ring (4px out), which its scroll would clip.
          !open && "-mx-3 -my-2 snap-x snap-mandatory auto-cols-[80%] grid-flow-col overflow-x-auto scroll-px-3 px-3 py-2 [scrollbar-width:none] sm:mx-0 sm:my-0 sm:grid-flow-row sm:overflow-visible sm:px-0 sm:py-0",
          !besideMap && "lg:grid-cols-3",
        )}
      >
        {items.map((item, index) => (
          <li key={item.id} className={cn("snap-start", folded && index >= FIRST_PLACES && "sm:hidden")}>
            {item.card}
          </li>
        ))}
      </ul>
      {!open && items.length > 1 && (
        // Wrapped, as a class on the button can't reliably override its own display (cn doesn't merge).
        <div className={cn(!folded && "sm:hidden")}>
          <Button type="button" variant="soft" size="touch" onClick={() => setOpen(true)}>
            Show all {items.length} places
          </Button>
        </div>
      )}
    </div>
  );
}
