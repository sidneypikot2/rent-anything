"use client";

import Link from "next/link";
import { useTripHref } from "@/components/trips/trip-link";
import { markLeaving } from "./back-link";
import { newTabProps, useOpensInNewTab } from "./business-row";

// A listing row's title: its ::after covers the card, so a click anywhere on it opens the
// listing's page (controls of the card's own sit above it with `relative z-10`). In a new tab on
// a laptop, so the list stays where the guest left it; in the same tab on a phone.
export function ListingTitleLink({ href, title, testId = "listing-open" }: { href: string; title: string; testId?: string }) {
  const newTab = useOpensInNewTab();
  const tripHref = useTripHref();
  return (
    <Link
      href={tripHref(href)}
      {...newTabProps(newTab)}
      onClick={() => !newTab && markLeaving()}
      data-testid={testId}
      aria-label={newTab ? `${title} (opens in a new tab)` : undefined}
      className="underline-offset-4 outline-none after:absolute after:inset-0 after:rounded-card after:content-[''] hover:underline focus-visible:after:outline-2 focus-visible:after:-outline-offset-4 focus-visible:after:outline-(--focus)"
    >
      {title}
    </Link>
  );
}
