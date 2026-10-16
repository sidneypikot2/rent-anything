"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { LAUNCH_AREA } from "@/components/landing/trip-start";
import { tripDatesQuery, type TripDates } from "@/components/trips/trip-dates";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { GlassPanel } from "@/components/ui/glass";
import { DateRangeCalendar } from "@/components/ui/date-range-field";
import { PillLink } from "@/components/ui/pill";
import { StepperField } from "@/components/ui/stepper-field";
import type { SearchResults } from "@/api/discovery";
import { formatDateRange, todayIso } from "@/lib/dates";
import { CATEGORIES, categoryHref, listingNote } from "./categories";
import { areaIcon, categoryIcon, placeIcon, tagIcon } from "./icons";
import { ArrowGlyph, CalendarGlyph, CategoryGlyph, CloseGlyph, GuestsGlyph, SearchGlyph } from "./tag-glyphs";

const MIN_LENGTH = 2;
const DEBOUNCE_MS = 250;
// Below `sm` the on-screen keyboard takes half the screen: the search moves to the top of
// the screen on focus, and the suggestions get the height left above the keyboard.
const PHONE = "(max-width: 639px)";
// From `lg` the hero's calendar shows two months side by side.
const WIDE = "(min-width: 64rem)";
const MIN_PANEL_PX = 160;
const MAX_GUESTS = 50;

type Panel = "where" | "when" | "guests" | null;

// The search: destinations, landmarks, activities and things to book as you type. It is a
// plain GET form, so Enter (or no JavaScript) opens the full results at /search, which also
// explains a query that is too short. The suggestions follow the ARIA combobox pattern (as
// ComboboxField does, RAA-75): arrow keys move through them, Enter picks the highlighted one,
// Escape closes the list. Picking a suggestion opens nothing yet: it fills Where and moves on
// to the dates, then the guests, and Show me goes to the picked place with them. Before anything is typed it offers where we launch and the kinds
// of things to book.
// On the home page's hero it is the page's main action: a line to fill in (go or do what,
// when, with whom), so the trip dates and guests travel with whatever is picked, into the
// destination page's `?from=&to=&guests=` (readTripDates). `bar` is the same three blanks in
// one row, for the search bar under the header on every other page (RAA-126), and stacked
// in a sheet on a phone. Otherwise it is one field, and keeps the dates it was given.
// `here`: the place the page is about. Show me with its name left as it is (or emptied) stays
// on this page with the new dates and guests, rather than searching for the name.
export function SearchBox({
  initialQuery = "",
  initialDates = { guests: 1 },
  hero = false,
  bar = false,
  here,
  onDone,
}: {
  initialQuery?: string;
  initialDates?: TripDates;
  hero?: boolean;
  bar?: boolean;
  here?: { name: string; href: string };
  // Called once the search has been sent, so a sheet holding it can close.
  onDone?: () => void;
}) {
  const router = useRouter();
  const [text, setText] = useState(initialQuery);
  const [query, setQuery] = useState("");
  const [panel, setPanel] = useState<Panel>(null);
  const [range, setRange] = useState({ from: initialDates.from ?? "", to: initialDates.to ?? "" });
  const [guests, setGuests] = useState(initialDates.guests);
  // The suggestion picked for Where; typing again drops it.
  const [picked, setPicked] = useState<Item | null>(null);
  const [twoMonths, setTwoMonths] = useState(false);
  // The highlighted suggestion, tied to the list it was picked in: new results start with
  // nothing highlighted, so the highlight never points at another item or past the list.
  const [highlight, setHighlight] = useState<{ items: Item[]; index: number } | null>(null);
  const listId = useId();
  const datesId = useId();
  const guestsId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const whenRef = useRef<HTMLButtonElement>(null);
  const guestsRef = useRef<HTMLButtonElement>(null);
  const open = panel === "where";
  const room = useRoomAboveKeyboard(formRef, open && hero);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(text.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text]);

  // Only a complete range travels; a half-picked one is dropped, as readTripDates would.
  const dates: TripDates = range.from && range.to ? { ...range, guests } : { guests };
  const carry = tripDatesQuery(dates);

  // Characters, not UTF-16 units, to match the API's count (an emoji is one).
  const enabled = [...query].length >= MIN_LENGTH;
  const { data, isError, refetch } = useQuery({
    queryKey: ["search", query],
    queryFn: async () => {
      const { data, error } = await apiClient().GET("/api/v1/search", { params: { query: { q: query } } });
      if (error || !data) throw new Error("Search failed");
      return data;
    },
    enabled,
    staleTime: 60_000,
  });

  const empty = data !== undefined && Object.values(data).every((group) => group.length === 0);
  // Hrefs without the dates: they are added when Show me is pressed, so dates picked after the
  // place still travel.
  const items = useMemo(
    () => (!enabled ? popularItems() : data ? suggestionItems(data, query) : []),
    [enabled, data, query],
  );
  // While a query waits for the debounce, the list it replaces stays shut rather than flicker.
  const typing = !enabled && [...text.trim()].length >= MIN_LENGTH;
  const expanded = open && !typing;
  // The keys only move through a list that is on screen.
  const listed = expanded && (!enabled || (!isError && data !== undefined && !empty));
  const active = listed && highlight?.items === items ? highlight.index : -1;
  const moveTo = (index: number) => setHighlight({ items, index });
  const optionId = (index: number) => `${listId}-${index}`;

  useEffect(() => {
    if (active >= 0) document.getElementById(optionId(active))?.scrollIntoView({ block: "nearest" });
    // optionId only depends on listId, which never changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // Fills Where with the suggestion and goes on to the dates, as the bar reads.
  function choose(item: Item) {
    setPicked(item);
    // "See all results" keeps what was typed.
    if (item.group) setText(item.title);
    setHighlight(null);
    setTwoMonths(window.matchMedia(WIDE).matches);
    setPanel("when");
    whenRef.current?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" && listed) {
      event.preventDefault();
      moveTo(Math.min(active + 1, items.length - 1));
    } else if (event.key === "ArrowUp" && listed) {
      event.preventDefault();
      // From nothing highlighted, up starts at the bottom of the list.
      moveTo(active < 0 ? items.length - 1 : Math.max(active - 1, 0));
    } else if (event.key === "Enter" && active >= 0) {
      event.preventDefault();
      choose(items[active]);
    } else if (event.key === "Escape" && expanded) {
      // Close the list first; the browser's own clear of a search field waits for the next Escape.
      event.preventDefault();
      setPanel(null);
      setHighlight(null);
    }
  }

  // Escape closes the calendar or the guests and goes back to the part that opened it.
  function onFormKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key !== "Escape" || (panel !== "when" && panel !== "guests")) return;
    event.preventDefault();
    (panel === "when" ? whenRef : guestsRef).current?.focus();
    setPanel(null);
  }

  function toggle(next: "when" | "guests") {
    if (next === "when") setTwoMonths(window.matchMedia(WIDE).matches);
    setPanel(panel === next ? null : next);
  }

  const input = (
    <input
      ref={inputRef}
      name="q"
      type="search"
      role="combobox"
      value={text}
      onChange={(event) => {
        setText(event.target.value);
        setPicked(null);
        setPanel("where");
        setHighlight(null);
      }}
      onFocus={() => {
        setPanel("where");
        if (hero && window.matchMedia(PHONE).matches) {
          const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          formRef.current?.scrollIntoView({ block: "start", behavior: smooth ? "smooth" : "auto" });
        }
      }}
      onKeyDown={onKeyDown}
      placeholder={hero ? "Bantayan, island hopping…" : "A place or activity"}
      aria-label={
        hero
          ? "Where to go or what to do: search destinations, landmarks and activities"
          : "Search destinations, landmarks and activities"
      }
      aria-autocomplete="list"
      aria-expanded={expanded}
      aria-controls={expanded ? listId : undefined}
      aria-activedescendant={expanded && active >= 0 ? optionId(active) : undefined}
      autoComplete="off"
      data-testid="search-input"
      className={cn(
        // The browser's own clear button is unstyled; the one below replaces it.
        "min-w-0 flex-1 bg-transparent text-base text-foreground caret-primary outline-none selection:bg-fern selection:text-navy placeholder:text-muted/80 [&::-webkit-search-cancel-button]:appearance-none",
        // In the hero the label gives the field its height.
        hero
          ? "w-full truncate font-semibold text-navy placeholder:font-medium placeholder:text-muted"
          : bar
            ? "w-full truncate font-semibold placeholder:font-medium"
            : "min-h-12",
      )}
    />
  );

  const clear = text && (
    <button
      type="button"
      aria-label="Clear search"
      onClick={() => {
        // The query too, so the old suggestions don't linger for the debounce.
        setText("");
        setQuery("");
        setPicked(null);
        setHighlight(null);
        inputRef.current?.focus();
      }}
      // In the bar it sits on the value's line, so it mustn't make the row taller.
      className={cn(
        "-mx-1 grid shrink-0 place-items-center rounded-full text-muted transition-colors duration-300 ease-calm hover:bg-surface hover:text-primary focus-visible:outline-2 focus-visible:outline-primary",
        bar ? "-my-2 size-8" : "size-10",
      )}
    >
      <CloseGlyph className="size-4.5" />
    </button>
  );

  const dateLabel = range.from && range.to ? formatDateRange(range.from, range.to) : null;

  return (
    <form
      ref={formRef}
      action="/search"
      role="search"
      className={cn("relative w-full scroll-mt-4 text-left", !hero && !bar && "max-w-xl")}
      onKeyDown={onFormKeyDown}
      onSubmit={(event) => {
        const typed = text.trim();
        if (picked) {
          event.preventDefault();
          setPanel(null);
          router.push(withDates(picked.href, carry));
        } else if (here && (!typed || typed === here.name)) {
          event.preventDefault();
          setPanel(null);
          router.push(`${here.href}${carry}`, { scroll: false });
        }
        onDone?.();
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPanel(null);
      }}
    >
      {/* What the GET form sends with the query, so Enter and the results page keep them too. */}
      {dates.from && <input type="hidden" name="from" value={dates.from} />}
      {dates.to && <input type="hidden" name="to" value={dates.to} />}
      {guests > 1 && <input type="hidden" name="guests" value={guests} />}

      {hero ? (
        // A line to fill in: go or do what, when, with whom. Each blank is a white chip on the
        // dark glass that turns pale blue once filled. From sm Where has the first row, and When,
        // Guests and the button the second. On a phone the lead words sit above their chips:
        // Where on its own row, When and Guests side by side, then the button.
        <GlassPanel
          tone="dark"
          className="grid grid-cols-2 gap-x-2 gap-y-3 card-edge rounded-card p-3 shadow-float sm:flex sm:flex-wrap sm:items-center sm:gap-x-4 sm:p-4 landscape-phone:gap-y-2 landscape-phone:p-2.5"
        >
          <label className={cn(BLANK, "col-span-2 sm:basis-full")}>
            <span className={cn(LEAD, ROW_LEAD)}>Go or do</span>
            <span className={cn(chipClasses(Boolean(text), panel === "where"), "min-w-0 flex-1 pr-1.5")}>
              {input}
              {clear}
            </span>
          </label>
          <button
            ref={whenRef}
            type="button"
            aria-haspopup="dialog"
            aria-expanded={panel === "when"}
            aria-controls={panel === "when" ? datesId : undefined}
            onClick={() => toggle("when")}
            data-testid="search-dates"
            className={cn(BLANK, "group outline-none")}
          >
            <span className={cn(LEAD, ROW_LEAD)}>when</span>
            <span className={chipClasses(Boolean(dateLabel), panel === "when")}>
              <CalendarGlyph className="size-4.5 shrink-0" />
              <span className="truncate">{dateLabel ?? "Add dates"}</span>
            </span>
          </button>
          <button
            ref={guestsRef}
            type="button"
            aria-haspopup="dialog"
            aria-expanded={panel === "guests"}
            aria-controls={panel === "guests" ? guestsId : undefined}
            onClick={() => toggle("guests")}
            data-testid="search-guests"
            className={cn(BLANK, "group outline-none")}
          >
            <span className={LEAD}>with</span>
            <span className={chipClasses(guests > 1, panel === "guests")}>
              <GuestsGlyph className="size-4.5 shrink-0" />
              <span className="truncate">{guests === 1 ? "just me" : `${guests} guests`}</span>
            </span>
          </button>
          <Button
            type="submit"
            variant="glow"
            size="pill"
            aria-label="Search"
            data-testid="search-submit"
            className="group/go col-span-2 min-h-12 gap-2 sm:ml-auto landscape-phone:min-h-11"
          >
            Show me
            <ArrowGlyph className="size-5 transition-transform duration-300 ease-calm group-hover/go:translate-x-0.5" />
          </Button>
        </GlassPanel>
      ) : bar ? (
        // Where, When and Guests on one row of the light glass bar, each word beside its own white
        // field, as the hero's line reads; on a phone (inside the sheet) each word sits above its
        // field, with Show me under them. A click on a word opens its field.
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4 sm:card-edge sm:rounded-full sm:bg-surface/90 sm:py-2 sm:pr-2 sm:pl-6 sm:shadow-lift sm:backdrop-blur-xl">
          <label className={cn(BAR_BLANK, "sm:flex-[1.5]")}>
            <span className={BAR_LABEL}>Where</span>
            <span className={cn(BAR_FIELD, "cursor-text pr-1.5", panel === "where" && BAR_FIELD_OPEN)}>{input}{clear}</span>
          </label>
          <label className={BAR_BLANK}>
            <span className={BAR_LABEL}>When</span>
            <button
              ref={whenRef}
              type="button"
              aria-haspopup="dialog"
              aria-expanded={panel === "when"}
              aria-controls={panel === "when" ? datesId : undefined}
              onClick={() => toggle("when")}
              data-testid="search-dates"
              className={cn(BAR_FIELD, !dateLabel && "font-medium text-muted", panel === "when" && BAR_FIELD_OPEN)}
            >
              <CalendarGlyph className="size-4 shrink-0 text-primary" />
              <span className="truncate">{dateLabel ?? "Add dates"}</span>
            </button>
          </label>
          <label className={BAR_BLANK}>
            <span className={BAR_LABEL}>Guests</span>
            <button
              ref={guestsRef}
              type="button"
              aria-haspopup="dialog"
              aria-expanded={panel === "guests"}
              aria-controls={panel === "guests" ? guestsId : undefined}
              onClick={() => toggle("guests")}
              data-testid="search-guests"
              className={cn(BAR_FIELD, guests === 1 && "font-medium text-muted", panel === "guests" && BAR_FIELD_OPEN)}
            >
              <GuestsGlyph className="size-4 shrink-0 text-primary" />
              <span className="truncate">{guests === 1 ? "Just me" : `${guests} guests`}</span>
            </button>
          </label>
          <Button type="submit" size="pill" data-testid="search-submit" className="group/go shrink-0 gap-2">
            Show me
            <ArrowGlyph className="size-4.5 transition-transform duration-300 ease-calm group-hover/go:translate-x-0.5" />
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-card border border-line-strong bg-surface p-1.5 pl-4 shadow-soft transition-[border-color,box-shadow] duration-300 ease-calm focus-within:border-primary focus-within:ring-4 focus-within:ring-sky-mist">
          {input}
          {clear}
          {/* On the smallest phones the button is its icon, so the placeholder fits in full. */}
          <Button type="submit" className="shrink-0 max-xs:px-3.5">
            <SearchGlyph className="size-5 xs:hidden" />
            <span className="max-xs:sr-only">Search</span>
          </Button>
        </div>
      )}

      {expanded && (
        <div
          data-testid="search-suggestions"
          // Keeps focus in the input while a suggestion is clicked: Safari doesn't focus a
          // clicked button, so the form's blur would close the panel before the click lands.
          onMouseDown={(event) => event.preventDefault()}
          // On a phone, only as tall as the room above the on-screen keyboard.
          style={room === null ? undefined : { maxHeight: Math.max(room, MIN_PANEL_PX) }}
          // Its own text colour, as the hero around it is glass.
          className={cn(
            PANEL,
            "inset-x-0 max-h-[45vh] overflow-y-auto overscroll-contain p-2 sm:max-h-[70vh]",
            (hero || bar) && "sm:right-auto sm:w-[min(100%,34rem)]",
            bar && IN_SHEET,
          )}
        >
          {!enabled ? (
            <Suggestions id={listId} items={items} active={active} optionId={optionId} query="" onChoose={choose} />
          ) : isError ? (
            <p role="status" className="p-3 text-sm text-muted">
              Search isn&apos;t available right now.{" "}
              <button
                type="button"
                onClick={() => refetch()}
                className="font-semibold text-link underline underline-offset-2"
              >
                Try again
              </button>
            </p>
          ) : !data ? (
            <p role="status" className="p-3 text-sm text-muted">
              Searching…
            </p>
          ) : empty ? (
            <NoMatches query={query} carry={carry} />
          ) : (
            <Suggestions id={listId} items={items} active={active} optionId={optionId} query={query} onChoose={choose} />
          )}
        </div>
      )}

      {panel === "when" && (
        <div
          id={datesId}
          role="dialog"
          aria-label="Trip dates"
          // Clicks on the calendar's padding keep focus inside the form, so it stays open.
          onMouseDown={keepFocus}
          className={cn(PANEL, "inset-x-0 flex flex-col gap-2 p-4 sm:right-auto sm:w-88 lg:w-[40rem]", bar && IN_SHEET, bar && "sm:left-1/4")}
        >
          <DateRangeCalendar
            from={range.from}
            to={range.to}
            onChange={setRange}
            min={todayIso()}
            months={twoMonths ? 2 : 1}
            onComplete={() => {
              // Dates picked: on to the guests, as the bar reads.
              setPanel("guests");
              guestsRef.current?.focus();
            }}
          />
          <PanelActions
            onClear={range.from ? () => setRange({ from: "", to: "" }) : undefined}
            onDone={() => {
              setPanel(null);
              whenRef.current?.focus();
            }}
          />
        </div>
      )}

      {panel === "guests" && (
        <div
          id={guestsId}
          role="dialog"
          aria-label="Guests"
          onMouseDown={keepFocus}
          className={cn(PANEL, "inset-x-0 flex flex-col gap-3 p-4 sm:right-auto sm:w-80", bar && IN_SHEET, bar && "sm:left-1/2")}
        >
          <StepperField
            label="Guests"
            hint="Everyone on the trip, kids too"
            value={guests}
            onChange={setGuests}
            min={1}
            max={MAX_GUESTS}
            data-testid="search-guests-count"
          />
          <PanelActions
            onDone={() => {
              setPanel(null);
              guestsRef.current?.focus();
            }}
          />
        </div>
      )}
    </form>
  );
}

// The panels under the bar: suggestions, the calendar, the guests.
const PANEL = "absolute right-0 top-full z-20 mt-2 card-edge rounded-card bg-surface text-foreground shadow-lift";
// On a phone the bar lives in a sheet, so its panels open in the flow, under the fields,
// where the sheet scrolls to them.
const IN_SHEET = "max-sm:static max-sm:shadow-none";
// One of the bar's blanks: its word, then its field; on a phone the word sits above.
const BAR_BLANK = "flex min-w-0 flex-1 flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2.5";
const BAR_LABEL = "text-sm font-semibold whitespace-nowrap text-foreground";
// The field itself: a white pill holding the value, ringed while its panel is open.
const BAR_FIELD =
  "flex min-h-12 w-full min-w-0 items-center gap-2 rounded-full border border-line-strong bg-surface px-4 text-left text-sm font-semibold transition-[border-color,box-shadow] duration-300 ease-calm hover:border-primary focus-visible:outline-2 focus-visible:outline-primary has-[input:focus-visible]:border-primary has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-sky-mist sm:min-h-11";
const BAR_FIELD_OPEN = "border-primary ring-2 ring-sky-mist";
// A blank in the hero's line: its lead word, then its chip. On a phone the word sits above.
const BLANK = "flex min-w-0 cursor-pointer flex-col gap-1 text-left sm:flex-row sm:items-center sm:gap-2.5";
const LEAD =
  "px-1 text-sm font-semibold text-sky-mist sm:px-0 sm:font-display sm:text-lg sm:text-white max-sm:short:sr-only landscape-phone:sr-only";
// From sm the word that starts each row ("Go or do", "when") shares one width, set flush right,
// so the search field and the dates chip start in one column under each other. In em, as it
// follows the lead's type; a min width, so a wider fallback font misaligns rather than clips.
const ROW_LEAD = "sm:min-w-[4.5em] sm:shrink-0 sm:text-right";

// The chip of a blank: white with a dashed rim while empty, pale blue once filled, ringed
// while its panel is open. The focus ring follows the button or the input inside.
function chipClasses(filled: boolean, open: boolean) {
  return cn(
    "flex min-h-12 min-w-0 items-center gap-2 rounded-full border px-4 text-base transition-[background-color,border-color,box-shadow] duration-300 ease-calm sm:min-h-13 landscape-phone:min-h-11",
    "group-focus-visible:ring-2 group-focus-visible:ring-sky-pale has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-sky-pale",
    filled
      ? "border-transparent bg-fern font-semibold text-navy"
      : "border-dashed border-line-strong bg-surface font-medium text-muted group-hover:border-primary",
    open ? "shadow-lift ring-2 ring-sky-pale" : "shadow-soft",
  );
}

function PanelActions({ onClear, onDone }: { onClear?: () => void; onDone: () => void }) {
  return (
    <div className="flex items-center justify-end gap-1 text-sm">
      {onClear && (
        <button type="button" onClick={onClear} className="mr-auto rounded-control px-3 py-2 font-medium text-link hover:bg-surface-2">
          Clear dates
        </button>
      )}
      <Button type="button" variant="soft" size="touch" onClick={onDone}>
        Done
      </Button>
    </div>
  );
}

function keepFocus(event: MouseEvent) {
  event.preventDefault();
}

// Nothing found is not a dead end: the kinds of things to book are one tap away.
function NoMatches({ query, carry }: { query: string; carry: string }) {
  return (
    <div className="flex flex-col gap-3 p-3">
      <p role="status" className="text-sm text-muted">
        Nothing matches “{query}” yet. Try one of these:
      </p>
      <ul className="flex flex-wrap gap-2">
        {CATEGORIES.map((category) => (
          <li key={category.label}>
            <PillLink href={withDates(categoryHref(category.query), carry)}>
              <CategoryGlyph name={category.icon} className="size-4.5 shrink-0 text-primary" />
              {category.label}
            </PillLink>
          </li>
        ))}
      </ul>
    </div>
  );
}

// The pixels between the form's bottom edge and the top of the on-screen keyboard while
// `active` on a phone; null elsewhere, where the panel's CSS max-height applies. It follows
// the visual viewport, which shrinks when the keyboard opens and moves as the page scrolls.
function useRoomAboveKeyboard(ref: RefObject<HTMLFormElement | null>, active: boolean) {
  const [room, setRoom] = useState<number | null>(null);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!active || !viewport || !window.matchMedia(PHONE).matches) return;
    const measure = () => {
      const form = ref.current;
      // The panel's 8px top margin and 16px clear of the keyboard.
      if (form) setRoom(Math.floor(viewport.offsetTop + viewport.height - form.getBoundingClientRect().bottom - 24));
    };
    measure();
    viewport.addEventListener("resize", measure);
    viewport.addEventListener("scroll", measure);
    window.addEventListener("scroll", measure, { passive: true });
    return () => {
      viewport.removeEventListener("resize", measure);
      viewport.removeEventListener("scroll", measure);
      window.removeEventListener("scroll", measure);
      setRoom(null);
    };
  }, [ref, active]);
  return room;
}

// A link with the trip dates and guests ("?from=…&to=…&guests=2", or "") added to its query,
// before any #hash.
function withDates(href: string, carry: string) {
  if (!carry) return href;
  const hash = href.indexOf("#");
  const [path, fragment] = hash < 0 ? [href, ""] : [href.slice(0, hash), href.slice(hash)];
  return `${path}${path.includes("?") ? `&${carry.slice(1)}` : carry}${fragment}`;
}

type Item = { group: string; href: string; icon: ReactNode; title: string; note?: string };

// Before anything is typed: where we launch and the kinds of things to book.
function popularItems(): Item[] {
  return [
    {
      group: "Where we launch",
      href: `/${LAUNCH_AREA.slug}`,
      icon: areaIcon(LAUNCH_AREA.kind),
      title: LAUNCH_AREA.name,
      note: "Beaches, island hopping and local partners",
    },
    ...CATEGORIES.map((category) => ({
      group: "Things to book",
      href: categoryHref(category.query),
      icon: categoryIcon(category.icon),
      title: category.label,
    })),
  ];
}

// Every suggestion in display order, ending with "See all results", so the arrow keys and
// the list agree on one index.
function suggestionItems(results: SearchResults, query: string): Item[] {
  return [
    ...results.areas.map((area) => ({
      group: "Destinations",
      href: `/${area.slug}`,
      icon: areaIcon(area.kind),
      title: area.name,
      note: area.parent_name ?? undefined,
    })),
    ...results.landmarks.map((landmark) => ({
      group: "Landmarks",
      href: `/${landmark.area.slug}#${landmark.slug}`,
      icon: placeIcon(),
      title: landmark.name,
      note: landmark.area.name,
    })),
    ...results.tags.map((tag) => ({
      group: "Activities & interests",
      href: `/search?q=${encodeURIComponent(tag.name)}`,
      icon: tagIcon(tag.slug),
      title: tag.name,
      note: tag.areas.map((area) => area.name).join(", "),
    })),
    ...results.listings.map((listing) => ({
      group: "Things to book",
      // The listing's own row on its destination page.
      href: `/${listing.area_slug}#listing-${listing.id}`,
      icon: categoryIcon(listing.category),
      title: listing.title,
      note: listingNote(listing, results),
    })),
    {
      group: "",
      href: `/search?q=${encodeURIComponent(query)}`,
      icon: <SearchGlyph className="size-[1.1em]" />,
      title: `See all results for “${query}”`,
    },
  ];
}

// The title with the first match of what was typed in bold, so a row shows why it is there.
function Matched({ title, query }: { title: string; query: string }) {
  const at = query ? title.toLowerCase().indexOf(query.toLowerCase()) : -1;
  if (at < 0) return title;
  return (
    <>
      {title.slice(0, at)}
      <strong className="font-bold text-navy">{title.slice(at, at + query.length)}</strong>
      {title.slice(at + query.length)}
    </>
  );
}

function Suggestions({
  id,
  items,
  active,
  optionId,
  query,
  onChoose,
}: {
  id: string;
  items: Item[];
  active: number;
  optionId: (index: number) => string;
  query: string;
  onChoose: (item: Item) => void;
}) {
  const groups = [...new Set(items.map((item) => item.group))];
  // A row is an icon in its well, the name and where it is. The highlighted row (pointer or
  // arrow keys) turns pale blue and its well white; nothing else changes.
  return (
    <div id={id} role="listbox" aria-label="Suggestions" className="flex flex-col">
      {groups.map((group) => (
        // "See all results" closes the list below a divider.
        <ul
          key={group || "all"}
          role="group"
          aria-label={group || undefined}
          className={cn(!group && "mt-1.5 border-t border-line pt-1.5")}
        >
          {group && (
            <li role="presentation" className="px-3 pb-1.5 pt-3 text-xs font-bold text-muted">
              {group}
            </li>
          )}
          {items.map((item, index) =>
            item.group === group ? (
              <li key={item.href + index} role="presentation">
                <button
                  type="button"
                  id={optionId(index)}
                  role="option"
                  aria-selected={index === active}
                  tabIndex={-1}
                  onClick={() => onChoose(item)}
                  className={cn(
                    "group/option flex min-h-12 w-full items-center gap-3 rounded-control px-2.5 py-1.5 text-left transition-colors duration-200 ease-calm hover:bg-mist",
                    index === active && "bg-mist",
                    !item.group && "min-h-11 text-sm font-semibold text-link",
                  )}
                >
                  {item.group ? (
                    <span
                      aria-hidden
                      className={cn(
                        "grid size-10 shrink-0 place-items-center rounded-control text-lg text-primary transition-colors duration-200 ease-calm group-hover/option:bg-surface",
                        index === active ? "bg-surface" : "bg-mist",
                      )}
                    >
                      {item.icon}
                    </span>
                  ) : (
                    <span aria-hidden className="grid w-10 shrink-0 place-items-center text-lg">
                      {item.icon}
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className={cn("block truncate", item.group && "font-medium text-foreground")}>
                      {item.group ? <Matched title={item.title} query={query} /> : item.title}
                    </span>
                    {item.note && <span className="block truncate text-xs text-muted">{item.note}</span>}
                  </span>
                </button>
              </li>
            ) : null,
          )}
        </ul>
      ))}
    </div>
  );
}
