"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";

// A plain click (main button, no modifier key): a modified one is left to the browser, so
// Cmd/Ctrl-click still opens the link in a new tab.
export function plainClick(event: MouseEvent) {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

// Whether this tab has a page of this site behind the current one: the Navigation API lists only
// the tab's same-origin entries, so `canGoBack` is false on a shared link, a new tab or the first
// page. A browser without the API gets the link.
function canGoBackInSite() {
  const navigation = (window as { navigation?: { canGoBack?: boolean } }).navigation;
  return navigation?.canGoBack === true;
}

// A page's way back (a listing's, a business's, What to book's): Back to whatever page of the
// site opened it in this tab — a place, What to book, a business, a plan step or the shop sheet
// over it — so it opens as the guest left it, scrolled as it was. With nothing of ours behind it
// (a shared link, a new tab from a laptop) it links to `href`, the page it would have come from.
export function BackLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  const router = useRouter();
  return (
    <Link
      href={href}
      className={className}
      data-testid="back-link"
      onClick={(event) => {
        if (!plainClick(event) || !canGoBackInSite()) return;
        event.preventDefault();
        router.back();
      }}
    >
      {children}
    </Link>
  );
}
