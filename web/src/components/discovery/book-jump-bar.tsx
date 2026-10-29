"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";

// A listing page's foot on a phone when its Add to trip sits in a card that picks rooms or
// vehicles first: the price and a button down to that card, so the next step is always in reach.
// It steps aside while the card's own Add row (`watch`) is on screen, so there is never a second
// button beside the real one.
export function BookJumpBar({
  target,
  watch,
  label,
  children,
}: {
  target: string;
  watch: string;
  label: string;
  children: ReactNode;
}) {
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const row = document.getElementById(watch);
    if (!row || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting));
    observer.observe(row);
    return () => observer.disconnect();
  }, [watch]);

  return (
    <Card
      data-testid="listing-add"
      aria-hidden={inView || undefined}
      className={cn(
        "sticky bottom-[calc(0.5rem+env(safe-area-inset-bottom))] z-20 order-last shadow-float transition duration-300 ease-calm sm:hidden",
        inView && "pointer-events-none translate-y-4 opacity-0",
      )}
    >
      <CardBody className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">{children}</div>
        <ButtonLink href={`#${target}`} glyph="arrow" tabIndex={inView ? -1 : undefined} className="shrink-0">
          {label}
        </ButtonLink>
      </CardBody>
    </Card>
  );
}
