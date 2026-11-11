"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

// What to book's loading file also catches the way into a section's Show all page
// (`/<area>/book/<group>`) before that page's own takes over: it shows the grid's skeleton there.
// Both are drawn on the server (they import the API's fetchers); this only picks by the URL.
export function BookLoadingPick({ page, list }: { page: ReactNode; list: ReactNode }) {
  const depth = usePathname().split("/").filter(Boolean).length;
  return depth > 2 ? list : page;
}
