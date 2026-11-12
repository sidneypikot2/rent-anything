"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { plainClick } from "@/components/discovery/back-link";
import { ChevronGlyph } from "@/components/discovery/tag-glyphs";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

// Leaving the planner asks first (RAA-303): a back press — the bar's ← on step 1, or the
// browser's or phone's Back (a swipe, Android's key) from the step the planner was entered on —
// opens "Leave trip planning?" with Stay and Leave, so a slip doesn't close the planner. Back
// between steps never asks.
//
// A browser can't hold its own Back (the Navigation API can't cancel a traversal yet), so the
// planner's first page gets a guard entry: a copy of itself pushed on top. Back from it lands on
// the same page underneath, which pushes the guard again and asks; Leave then goes back past both.

const GUARD = "raaPlanGuard";

function inPlan(url: string) {
  const path = new URL(url, window.location.href).pathname;
  return path === "/plan" || path.startsWith("/plan/");
}

function onGuard() {
  return (window.history.state as Record<string, unknown> | null)?.[GUARD] === true;
}

// Next copies its own state into what is pushed, so the entry stays one of its pages.
function pushGuard() {
  if (!onGuard()) window.history.pushState({ [GUARD]: true }, "", window.location.href);
}

type Navigation = { currentEntry?: { index: number } | null; entries?: () => { url: string | null }[] };

// Whether this page was reached from another planner page in this tab. A browser without the
// Navigation API can't tell, so only step 1 (`entry`) counts as the way in.
function cameFromPlan(entry: boolean) {
  const navigation = (window as { navigation?: Navigation }).navigation;
  const index = navigation?.currentEntry?.index;
  if (navigation?.entries && index != null) {
    const previous = navigation.entries()[index - 1]?.url;
    return previous ? inPlan(previous) : false;
  }
  return !entry;
}

// Whether the dialog is open, and why: the ← ("link") or the browser's Back ("history"). Kept
// outside the component, as a Back makes Next render the page again and can remount it.
type Asking = "link" | "history" | null;
let asking: Asking = null;
const listeners = new Set<() => void>();
function setAsking(next: Asking) {
  asking = next;
  listeners.forEach((listener) => listener());
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// One popstate listener for the tab, added by the first planner page, so a page remounting
// during the Back can't miss it. `wasGuard`: whether the tab was on the guard before this Back.
let wasGuard = false;
let leaving = false;
let listening = false;
function listen() {
  if (listening) return;
  listening = true;
  window.addEventListener("popstate", () => {
    // Back off the guard, onto the same page under it: put the guard back and ask.
    if (!leaving && wasGuard && !onGuard() && inPlan(window.location.href)) {
      pushGuard();
      setAsking("history");
    }
    wasGuard = onGuard();
  });
}

// The plan bar's ← and the guard. `leaves`: the ← itself leaves the planner (step 1, to home),
// so it asks too.
export function PlanBackButton({ href, label, leaves = false }: { href: string; label: string; leaves?: boolean }) {
  const router = useRouter();
  const open = useSyncExternalStore(subscribe, () => asking, () => null);

  useEffect(() => {
    listen();
    leaving = false;
    if (!cameFromPlan(leaves)) pushGuard();
    wasGuard = onGuard();
  }, [leaves]);

  const leave = () => {
    leaving = true;
    const how = asking;
    setAsking(null);
    // Past the guard and the page under it; with nothing before them (a shared link), home.
    if (how === "history" && window.history.length > 2) window.history.go(-2);
    else router.push(how === "link" ? href : "/");
  };

  return (
    <>
      <Link
        href={href}
        aria-label={label}
        data-testid="plan-back"
        onClick={(event) => {
          if (!leaves || !plainClick(event)) return;
          event.preventDefault();
          setAsking("link");
        }}
        className="flex size-11 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-navy transition-colors duration-300 ease-calm hover:bg-surface-2"
      >
        <ChevronGlyph direction="left" className="size-5" />
      </Link>
      <Dialog
        open={open !== null}
        onClose={() => setAsking(null)}
        title="Leave trip planning?"
        data-testid="leave-plan"
        actions={
          <>
            <Button type="button" variant="soft" onClick={leave} data-testid="leave-plan-leave">
              Leave
            </Button>
            <Button type="button" onClick={() => setAsking(null)} data-testid="leave-plan-stay">
              Stay
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">Anything you&apos;ve added stays in your trip, so you can pick up where you left off.</p>
      </Dialog>
    </>
  );
}
