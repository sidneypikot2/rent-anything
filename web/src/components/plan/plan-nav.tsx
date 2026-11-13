"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createContext, useContext, useRef, useState, useTransition, type ComponentProps, type ReactNode } from "react";
import { LinkPendingOverride } from "@/components/ui/link-pending";

// Moving between the planner's pages (Trip, the checklist, Review) keeps the page on screen until
// the next one is ready: they have no loading.tsx, which swapped the whole sheet, track included,
// for a skeleton, and looked like a reload. While the next page loads, the clicked control spins at
// once and, past SKELETON_DELAY, the content under the bar and track becomes the next page's
// skeleton (`PlanPending`), so a slow network shows the page coming and a fast one never flashes.
export type PlanTarget = "trip" | "checklist" | "review";

const SKELETON_DELAY = 200;

type PlanNav = {
  go: (href: string) => void;
  // The navigation under way, from the click until the next page shows.
  navigating: boolean;
  // Which page is coming, once the skeleton is due.
  pending: PlanTarget | null;
  href: string | null;
};

const PlanNavContext = createContext<PlanNav>({ go: () => {}, navigating: false, pending: null, href: null });

export function usePlanNav() {
  return useContext(PlanNavContext);
}

// The planner's page a link opens: `/plan` is step 1, `…/review` the review, any other the checklist.
export function targetOf(href: string): PlanTarget {
  const path = href.split(/[?#]/)[0];
  if (path === "/plan") return "trip";
  return path.endsWith("/review") ? "review" : "checklist";
}

// In PlanFrame, around every planner page. The navigation runs in a transition, so `navigating`
// is exactly while it is under way: a superseded or abandoned one can't leave a skeleton behind.
export function PlanNavProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [navigating, start] = useTransition();
  // The latest navigation, and the one whose skeleton is due (a later click restarts the wait).
  const [current, setCurrent] = useState<{ id: number; href: string } | null>(null);
  const [due, setDue] = useState<number | null>(null);
  const count = useRef(0);
  const go = (href: string) => {
    // A second press while that page is on its way changes nothing.
    if (navigating && current?.href === href) return;
    const id = ++count.current;
    setCurrent({ id, href });
    setTimeout(() => setDue(id), SKELETON_DELAY);
    start(() => router.push(href));
  };
  const live = navigating ? current : null;
  const pending = live && due === live.id ? targetOf(live.href) : null;
  return <PlanNavContext value={{ go, navigating, pending, href: live?.href ?? null }}>{children}</PlanNavContext>;
}

// A link to another planner page. A plain click goes through `go` (the skeleton, above); a
// modified or middle click, or one in a new tab, stays the link's own. Its `LinkPending` spinner
// follows `go`, as the Link itself doesn't navigate then.
export function PlanNavLink({ href, onClick, ...props }: ComponentProps<typeof Link>) {
  const nav = usePlanNav();
  const url = typeof href === "string" ? href : null;
  return (
    <LinkPendingOverride value={url !== null && nav.href === url}>
      <Link
        href={href}
        {...props}
        onClick={(event) => {
          onClick?.(event);
          if (!url || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || props.target) return;
          event.preventDefault();
          nav.go(url);
        }}
      />
    </LinkPendingOverride>
  );
}

// The step's content (and its foot), hidden while another planner page is on its way; the
// skeleton shows in its place (`PlanPendingSkeleton`). Hidden, not unmounted, so a step keeps its
// state. `contents` keeps the step's own layout (the sticky foot, flex-1).
export function PlanPending({ children }: { children: ReactNode }) {
  return <div className={usePlanNav().pending ? "hidden" : "contents"}>{children}</div>;
}
