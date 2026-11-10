"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ComponentProps, type CSSProperties, type MouseEvent, type RefObject } from "react";
import { useTripHere } from "@/components/trips/use-trip-here";
import { cn } from "@/components/ui/cn";
import { PlanTripLink } from "@/components/landing/plan-trip-start";

// A tab jumps to a section on the page, or with `href` opens another page (What to book's own).
type Tab = { id: string; label: string; href?: string };

// How far down the header reaches (--chrome, in rem or px).
function readChrome() {
  const chrome = getComputedStyle(document.documentElement).getPropertyValue("--chrome").trim();
  const px = chrome.endsWith("rem") ? parseFloat(chrome) * 16 : parseFloat(chrome);
  return Number.isFinite(px) ? px : 80;
}

// Where a section counts as reached: just under the header and this bar.
function readLine() {
  return readChrome() + 80;
}

// A tab's jump: a smooth scroll that lands the section under the header and this bar, which
// html's scroll padding (--chrome) alone leaves the heading under.
function jumpTo(event: MouseEvent<HTMLAnchorElement>, id: string, bar: HTMLElement | null) {
  if (!document.getElementById(id) || event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
  event.preventDefault();
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  scrollToSection(id, bar, reduce ? "auto" : "smooth");
  history.replaceState(history.state, "", `#${id}`);
  // Where an anchor's own jump would leave it: the keyboard's next Tab goes on inside the section.
  const target = document.getElementById(id);
  if (target && target.tabIndex < 0 && !target.hasAttribute("tabindex")) {
    target.setAttribute("tabindex", "-1");
    target.setAttribute("data-jump-target", "");
  }
  target?.focus({ preventScroll: true });
}

// A link elsewhere on the page down to one of the bar's sections (the banner's "8 places to
// see"), jumping as the bar's own tabs do.
export function SectionLink({ id, ...props }: { id: string } & Omit<ComponentProps<"a">, "href" | "onClick">) {
  return <a {...props} href={`#${id}`} onClick={jumpToSection(id)} />;
}

// The same jump for a link drawn by another component (a ButtonLink to #places): a plain hash
// link does nothing while the URL already ends in it, and lands the section under the header.
export function jumpToSection(id: string) {
  return (event: MouseEvent<HTMLAnchorElement>) =>
    jumpTo(event, id, document.querySelector<HTMLElement>("[data-area-nav]"));
}

function scrollToSection(id: string, bar: HTMLElement | null, behavior: ScrollBehavior) {
  const target = document.getElementById(id);
  if (!target) return;
  const below = (bar?.offsetHeight ?? 56) + 16;
  const top = target.getBoundingClientRect().top + window.scrollY - readChrome() - below;
  window.scrollTo({ top, behavior });
}

// A load or refresh at a tab's #section lands the same as the tab's jump, once the page has laid
// out: the browser's own jump leaves the heading under the bar, and the banner's late layout
// throws it off.
function useLandOnHash(tabs: Tab[], bar: RefObject<HTMLElement | null>) {
  useEffect(() => {
    // Compared raw, as ListingBrowser does: decoding a mangled hash (#%E0) would throw.
    const id = tabs.find((tab) => !tab.href && `#${tab.id}` === window.location.hash)?.id;
    if (!id) return;
    const land = () => scrollToSection(id, bar.current, "auto");
    const frame = requestAnimationFrame(land);
    // Again once images and fonts are in, unless the guest has scrolled away meanwhile.
    let moved = false;
    const away = () => (moved = true);
    const settled = () => !moved && land();
    window.addEventListener("wheel", away, { passive: true, once: true });
    window.addEventListener("touchmove", away, { passive: true, once: true });
    window.addEventListener("keydown", away, { once: true });
    if (document.readyState !== "complete") window.addEventListener("load", settled, { once: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("wheel", away);
      window.removeEventListener("touchmove", away);
      window.removeEventListener("keydown", away);
      window.removeEventListener("load", settled);
    };
    // Only on arrival: tabs come from the server and don't change after.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

// The section the guest is reading: the one whose top passed under the bar most recently.
function useCurrent(tabs: Tab[]) {
  const [current, setCurrent] = useState<string | null>(null);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const line = readLine();
      // The passed one nearest the bar.
      let found: string | null = null;
      let nearest = -Infinity;
      for (const tab of tabs) {
        if (tab.href) continue;
        const top = document.getElementById(tab.id)?.getBoundingClientRect().top;
        if (top !== undefined && top <= line + 8 && top > nearest) {
          nearest = top;
          found = tab.id;
        }
      }
      setCurrent(found);
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
  return current;
}

// Which ends of a sideways row have more past them, so the row can fade there: with its scrollbar
// hidden, a tab cut at the edge is the only sign the row scrolls, and it read as a cut-off label.
function useScrollEdges(row: RefObject<HTMLElement | null>) {
  const [edges, setEdges] = useState({ start: false, end: false });
  useEffect(() => {
    const el = row.current;
    if (!el) return;
    const update = () => {
      const start = el.scrollLeft > 1;
      const end = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
      setEdges((was) => (was.start === start && was.end === end ? was : { start, end }));
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const resize = new ResizeObserver(update);
    resize.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      resize.disconnect();
    };
  }, [row]);
  return edges;
}

// The page's other Plan a trip buttons: the banner's (wide or compact), Sample days' and the
// closing band's.
const OTHER_PLANS =
  "[data-testid='plan-trip'], [data-testid='plan-trip-compact'], [data-testid='plan-from-days'], [data-testid='area-trip-band-open']";

// The first of those on screen below `top`. A display:none one (the other layout's) has no size.
function otherPlanOnScreen(top: number) {
  return Array.from(document.querySelectorAll<HTMLElement>(OTHER_PLANS)).find((el) => {
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.bottom > top && rect.top < window.innerHeight;
  });
}

// Whether none of those is on screen below the header (and this bar, once it sticks), so the
// bar's own Plan a trip shows only then and the guest never sees two at once.
function useOtherPlanHidden(bar: RefObject<HTMLElement | null>) {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const chrome = readChrome();
      const rect = bar.current?.getBoundingClientRect();
      const top = rect && rect.top <= chrome + 1 ? rect.bottom : chrome;
      setHidden(!otherPlanOnScreen(top));
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
  }, [bar]);
  return hidden;
}

// On a phone the site header slides away once this bar reaches it (from Places to see on), and
// the bar takes the window's top (globals.css, [data-header-away]). Judged by where the bar
// would sit unstuck — its column's top — against the header's foot, so the header leaving
// (and the bar moving up) never flips it back.
function useHeaderAway(bar: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = document.documentElement;
    let frame = 0;
    const update = () => {
      frame = 0;
      const column = bar.current?.parentElement;
      const header = document.querySelector<HTMLElement>("[data-site-header]");
      if (!column || !header) return;
      const top = column.getBoundingClientRect().top + parseFloat(getComputedStyle(column).paddingTop);
      root.toggleAttribute("data-header-away", top <= header.offsetHeight + 12);
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
      root.removeAttribute("data-header-away");
    };
  }, [bar]);
}

function fadeMask({ start, end }: { start: boolean; end: boolean }): CSSProperties | undefined {
  if (!start && !end) return undefined;
  const mask = `linear-gradient(to right, ${start ? "transparent, black 2.5rem" : "black"}, ${end ? "black calc(100% - 2.5rem), transparent" : "black"})`;
  return { maskImage: mask, WebkitMaskImage: mask };
}

// A tab, the current one subtly: ink text over a short underline that grows in.
const TAB = cn(
  "relative flex min-h-11 items-center justify-center rounded-full px-4 text-sm font-semibold whitespace-nowrap transition-colors duration-300 ease-calm hover:bg-tag",
  "after:absolute after:inset-x-4 after:bottom-1.5 after:h-0.5 after:origin-center after:rounded-full after:bg-action after:transition-transform after:duration-300 after:ease-calm",
);

// An area page's sections as one white bar that sticks under the header (RAA-252), the current
// one marked, with Plan a trip at its end from sm while no other one is on screen. Only the sections the place has;
// What to book's tab opens its own page.
export function AreaNav({ tabs, planHref }: { tabs: Tab[]; planHref: string }) {
  const current = useCurrent(tabs);
  const list = useRef<HTMLUListElement>(null);
  const bar = useRef<HTMLElement>(null);
  const edges = useScrollEdges(list);
  const showPlan = useOtherPlanHidden(bar);
  useLandOnHash(tabs, bar);
  useHeaderAway(bar);
  // Keep the marked tab in view where the row scrolls sideways.
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
      ref={bar}
      data-area-nav
      aria-label="On this page"
      data-testid="area-nav"
      className={cn(
        "sticky top-(--chrome) z-20 card-edge flex items-center rounded-full bg-surface px-3 py-1.5 text-navy shadow-soft",
        "transition-[top] duration-500 ease-soft motion-reduce:transition-none",
      )}
    >
      <ul ref={list} style={fadeMask(edges)} className="flex min-w-0 flex-1 gap-1 overflow-x-auto [scrollbar-width:none]">
        {tabs.map((tab) => (
          <li key={tab.id} className="flex-1 shrink-0">
            {tab.href ? (
              <Link href={tab.href} data-tab={tab.id} data-testid={`area-nav-${tab.id}`} className={cn(TAB, "text-muted after:scale-x-0 hover:text-navy")}>
                {tab.label}
                <span aria-hidden className="ml-1.5 text-action-ink">→</span>
              </Link>
            ) : (
              <a
                href={`#${tab.id}`}
                data-tab={tab.id}
                onClick={(event) => jumpTo(event, tab.id, bar.current)}
                aria-current={current === tab.id ? "location" : undefined}
                className={cn(TAB, current === tab.id ? "text-action-ink after:scale-x-100" : "text-muted after:scale-x-0 hover:text-navy")}
              >
                {tab.label}
              </a>
            )}
          </li>
        ))}
      </ul>
      {/* Takes no room while hidden. Arriving, its room opens (the tabs glide aside) and then it
          fades in; leaving, it fades out and then its room closes: one step at a time. */}
      <div
        inert={!showPlan}
        className={cn(
          "grid shrink-0 transition-[grid-template-columns] duration-300 ease-calm max-sm:hidden",
          showPlan ? "grid-cols-[1fr]" : "grid-cols-[0fr] delay-200",
        )}
      >
        <div className="min-w-0 overflow-hidden">
          <PlanTripLink
            href={planHref}
            size="sm"
            arrow
            data-testid="area-nav-plan"
            className={cn(
              "ml-2 whitespace-nowrap transition-opacity duration-200 ease-calm",
              showPlan ? "opacity-100 delay-200" : "opacity-0",
            )}
          >
            Plan a trip
          </PlanTripLink>
        </div>
      </div>
    </nav>
  );
}

// A phone's foot (RAA-252): once the banner has scrolled away, the place and the page's dates
// with Plan a trip, never while another is on screen (Sample days'; the closing band's View trip).
// Below sm, where the section bar has none; partners and admins don't plan.
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
      const band = document.querySelector("[data-testid='area-trip-band']")?.getBoundingClientRect();
      const height = window.innerHeight;
      const pastBanner = Boolean(start && start.top < height * 0.4) || window.scrollY > height * 0.8;
      const atBand = Boolean(band && band.top < height);
      setShown(pastBanner && !atBand && !otherPlanOnScreen(readChrome()));
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
        "fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 border-t border-line bg-surface px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] text-navy shadow-float sm:hidden",
        "transition-[opacity,translate] duration-500 ease-calm",
        !shown && "pointer-events-none translate-y-full opacity-0",
      )}
    >
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block truncate text-sm font-bold">{place}</span>
        <span className="block truncate text-small text-muted">{when}</span>
      </span>
      <PlanTripLink href={href} places={places} tabIndex={shown ? undefined : -1} size="sm" arrow className="shrink-0">
        Plan a trip
      </PlanTripLink>
    </div>
  );
}
