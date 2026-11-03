"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";

// A plain click (main button, no modifier key): a modified one is left to the browser, so
// Cmd/Ctrl-click still opens the link in a new tab.
export function plainClick(event: MouseEvent) {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

// Where the guest left from in this tab (a What to book card's link to a business's page), held
// in memory: it lasts through a client navigation and is gone in a new tab or after a reload.
let leftFrom: string | null = null;
export function markLeaving() {
  leftFrom = window.location.pathname;
}

// A page's way back to the place it came from (a business's page, reached from What to book in
// the same tab on a phone): Back, so the place opens where the guest left it, scrolled as it was;
// opened in a tab of its own (from a laptop, or a shared link) there is nothing to go back to, so
// it links there.
export function BackLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  const router = useRouter();
  return (
    <Link
      href={href}
      className={className}
      data-testid="back-link"
      onClick={(event) => {
        if (!plainClick(event) || !leftFrom || leftFrom !== new URL(href, window.location.href).pathname) return;
        event.preventDefault();
        leftFrom = null;
        router.back();
      }}
    >
      {children}
    </Link>
  );
}
