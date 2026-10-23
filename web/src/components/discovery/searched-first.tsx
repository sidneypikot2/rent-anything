"use client";

import { useState, type ReactNode } from "react";

// Which section leads an area page: What to book when the guest came with a search (dates, a
// category, words typed), the places to see for an open-ended start. Decided on arrival and kept,
// so dates the page fills in itself (a trip's, AreaHero) never reorder it under the guest; only a
// new search on the page (`asked`) brings What to book up.
export function SearchedFirst({
  searched,
  asked,
  places,
  listings,
}: {
  searched: boolean;
  asked: boolean;
  places: ReactNode;
  listings: ReactNode;
}) {
  const [first, setFirst] = useState(searched);
  // Set while rendering (React's "adjusting state when a prop changes"), not in an effect.
  if (asked && !first) setFirst(true);
  return first ? (
    <>
      {listings}
      {places}
    </>
  ) : (
    <>
      {places}
      {listings}
    </>
  );
}
