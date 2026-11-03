"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useTripHere } from "@/components/trips/use-trip-here";
import { cn } from "@/components/ui/cn";
import { ArrowGlyph } from "@/components/discovery/tag-glyphs";

type Tab = { id: string; label: string };

// Where a section counts as reached: just under the header (--chrome, in rem or px) and this bar.
function readLine() {
  const chrome = getComputedStyle(document.documentElement).getPropertyValue("--chrome").trim();
  const px = chrome.endsWith("rem") ? parseFloat(chrome) * 16 : parseFloat(chrome);
  return (Number.isFinite(px) ? px : 80) + 64;
}

// The section the guest is reading: the last one whose top has passed under the bar.
function useCurrent(tabs: Tab[]) {
  const [current, setCurrent] = useState<string | null>(null);
  const [inListings, setInListings] = useState(false);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const line = readLine();
      let found: string | null = null;
      for (const tab of tabs) {
        const top = document.getElementById(tab.id)?.getBoundingClientRect().top;
        if (top !== undefined && top <= line + 8) found = tab.id;
      }
      setCurrent(found);
      // What to book's own chips and rail stick under the header there, so the bar steps aside.
      const listings = document.getElementById("listings")?.getBoundingClientRect();
      setInListings(Boolean(listings && listings.top <= line && listings.bottom > line));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      cancelAnimationFrame(frame);
    };
  }, [tabs]);
  return { current, inListings };
}

// An area page's sections as one white bar that sticks under the header (RAA-252), the current
// one marked, with Plan a trip at its end from sm. Only the sections the place has. It steps
// aside while What to book is under it, whose own filters stick there.
export function AreaNav({ tabs, planHref }: { tabs: Tab[]; planHref: string }) {
  const { current, inListings } = useCurrent(tabs);
  const list = useRef<HTMLUListElement>(null);
  // Keep the marked tab in view on a phone, where the row scrolls sideways.
  useEffect(() => {
    const link = current && list.current?.querySelector<HTMLElement>(`[data-tab="${current}"]`);
    if (!link || !list.current) return;
    const row = list.current;
    const left = link.offsetLeft - row.clientWidth / 2 + link.clientWidth / 2;
    row.scrollTo({ left, behavior: "smooth" });
  }, [current]);
  if (tabs.length < 3) return null;
  return (
    <nav
      aria-label="On this page"
      data-testid="area-nav"
      className={cn(
        "sticky top-(--chrome) z-20 card-edge flex items-center gap-2 rounded-full bg-surface p-1.5 text-navy shadow-soft",
        "transition-[opacity,translate] duration-500 ease-calm",
        inListings && "pointer-events-none -translate-y-2 opacity-0",
      )}
    >
      <ul ref={list} className="flex min-w-0 flex-1 gap-1 overflow-x-auto [scrollbar-width:none]">
        {tabs.map((tab) => (
          <li key={tab.id} className="shrink-0">
            <a
              href={`#${tab.id}`}
              data-tab={tab.id}
              aria-current={current === tab.id ? "location" : undefined}
              className={cn(
                "flex min-h-10 items-center rounded-full px-3.5 text-sm font-semibold whitespace-nowrap transition-colors duration-300 ease-calm",
                current === tab.id ? "bg-action text-white" : "text-muted hover:bg-tag hover:text-navy",
              )}
            >
              {tab.label}
            </a>
          </li>
        ))}
      </ul>
      <Link
        href={planHref}
        className="hidden min-h-10 shrink-0 items-center gap-1.5 rounded-full bg-action px-4 text-sm font-bold text-white sm:flex"
      >
        Plan a trip
        <ArrowGlyph className="size-4" />
      </Link>
    </nav>
  );
}

// A phone's foot (RAA-252): once the banner has scrolled away, the place and the page's dates
// with Plan a trip, until What to book comes up (where the floating dock's Map and Plan a trip
// take over) or the closing band, which has its own. Below lg; partners and admins don't plan.
export function PlanFoot({
  href,
  place,
  when,
  places,
}: {
  href: string;
  place: string;
  when: string;
  places: string[];
}) {
  const { session, isGuest } = useTripHere(places);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const start = document.querySelector("[data-testid='area-nav']")?.getBoundingClientRect();
      const listings = document.getElementById("listings")?.getBoundingClientRect();
      const band = document.querySelector("[data-testid='area-trip-band']")?.getBoundingClientRect();
      const height = window.innerHeight;
      const pastBanner = Boolean(start && start.top < height * 0.4) || window.scrollY > height * 0.8;
      const atListings = Boolean(listings && listings.top < height / 2 && listings.bottom > 0);
      const atBand = Boolean(band && band.top < height);
      setShown(pastBanner && !atListings && !atBand);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      cancelAnimationFrame(frame);
    };
  }, []);
  if (session && !isGuest) return null;
  return (
    <div
      data-testid="plan-foot"
      aria-hidden={!shown}
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 border-t border-line bg-surface px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] text-navy shadow-float lg:hidden",
        "transition-[opacity,translate] duration-500 ease-calm",
        !shown && "pointer-events-none translate-y-full opacity-0",
      )}
    >
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block truncate text-sm font-bold">{place}</span>
        <span className="block truncate text-small text-muted">{when}</span>
      </span>
      <Link
        href={href}
        tabIndex={shown ? undefined : -1}
        className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-action px-5 text-sm font-bold text-white"
      >
        Plan a trip
        <ArrowGlyph className="size-4" />
      </Link>
    </div>
  );
}
