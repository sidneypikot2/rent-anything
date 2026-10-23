"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ComponentProps,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { useHeroTripReport, useStartTrip } from "@/components/landing/hero-trip";
import { LAUNCH_AREA, startTripHref } from "@/components/landing/launch-area";
import { readTripDates, tripDatesQuery, tripOwnQuery, withDates, type TripDates } from "@/components/trips/trip-dates";
import { tripPlaces } from "@/components/trips/trip-places";
import { useTripHere } from "@/components/trips/use-trip-here";
import { useContinueTrip, type Trip } from "@/components/trips/use-trips";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { DateRangeCalendar } from "@/components/ui/date-range-field";
import { Pill } from "@/components/ui/pill";
import { StepperField } from "@/components/ui/stepper-field";
import type { AreaCard, SearchResults } from "@/api/discovery";
import { useSession } from "@/lib/auth/session";
import { formatDateRange, localTodayIso, todayIso } from "@/lib/dates";
import { countLine, groupDestinations, withSubAreas } from "./cards";
import { NoMatches } from "./no-matches";
import { listingNote } from "./categories";
import { areaIcon, categoryIcon, placeIcon, tagIcon } from "./icons";
import { ArrowGlyph, ChevronGlyph, CloseGlyph, SearchGlyph } from "./tag-glyphs";
import { guestsLabel, thingCount } from "@/components/trips/format";

const MIN_LENGTH = 2;
const DEBOUNCE_MS = 250;
// Below `sm` the on-screen keyboard takes half the screen: the search moves to the top of
// the screen on focus, and the suggestions get the height left above the keyboard.
const PHONE = "(max-width: 749px)";
// From `lg` the hero's calendar shows two months side by side.
const WIDE = "(min-width: 64rem)";
const MIN_PANEL_PX = 160;
// About how tall the calendar and the guests open under the hero's card, with their margin.
const WHEN_PANEL_PX = 440;
const GUESTS_PANEL_PX = 300;
const MAX_GUESTS = 50;
// The guests panel's shortcuts. A barkada is a group of friends, which the label says for a visitor.
const GROUP_SIZES = [
  { label: "Just me", count: 1 },
  { label: "Couple", count: 2 },
  { label: "Family of 4", count: 4 },
  { label: "Barkada (8 friends)", count: 8 },
];

type Panel = "where" | "when" | "guests" | null;

// The search: destinations, landmarks, activities and things to book as you type. It is a
// plain GET form, so Enter (or no JavaScript) opens the full results at /search, which also
// explains a query that is too short. The suggestions follow the ARIA combobox pattern (as
// ComboboxField does, RAA-75): arrow keys move through them, Enter picks the highlighted one,
// Escape closes the list. Picking a suggestion opens nothing yet: it fills Where and moves on
// to the dates, then the guests, and the button goes to the picked place with them. Before anything
// is typed it offers the destinations (RAA-130): Where answers where, and the hero's shortcuts
// under it (HeroCategories) are the one way to the kinds of things to book.
// On the home page's hero it is the page's main action, starting a trip: Where opens on the
// launch area, already picked, so a visitor only adds dates and guests and presses Start your
// trip, which lands on that destination's things to book with its trip lead saying the trip starts there (RAA-80)
// and the dates and guests in its `?from=&to=&guests=` (readTripDates). Another destination
// starts a trip there, and so does a thing to book, on its own row of its destination; anything
// else picked or typed is a search, and the button says so.
// Partners and admins have no cart, so for them the hero's button is always a search. The hero
// tells the rest of it (HeroTrip) the dates, guests and destination, for the category pills, and whether the
// button starts a trip, for the note under it. `bar` is the same three blanks as stops on a
// route, for the search bar under the header on every other page (RAA-126): across from sm,
// down a sheet on a phone. Otherwise it is one field, and keeps the dates it was given.
// `sheet`: the hero's search in the sheet a phone opens from its pill (HeroSearch), its panels
// in the flow as the bar's are there.
// `request`: open When or Guests on a page's asking (a new `n` each time), for the bar.
// `here`: the place the page is about. Search with its name left as it is (or emptied) stays
// on this page with the new dates and guests, rather than searching for the name. Anything else
// typed there searches that place's things to book (`area`'s page, `?q=`), not every place:
// the suggestions lead with that search and end on "Search all places".
// The search never changes a trip: a trip's own dates change from the cart (Rename or change
// dates); an add with dates outside it stretches it (the server's).
export function SearchBox({
  initialQuery = "",
  initialDates = { guests: 1 },
  hero = false,
  bar = false,
  sheet = false,
  here,
  request,
  onDone,
}: {
  request?: { panel: "where" | "when" | "guests"; n: number };
  initialQuery?: string;
  initialDates?: TripDates;
  hero?: boolean;
  bar?: boolean;
  sheet?: boolean;
  here?: { name: string; href: string; area: string };
  // Called once the search has been sent, so a sheet holding it can close.
  onDone?: () => void;
}) {
  const router = useRouter();
  const [text, setText] = useState(hero ? LAUNCH_AREA.name : initialQuery);
  const [query, setQuery] = useState("");
  const [panel, setPanel] = useState<Panel>(null);
  const [range, setRange] = useState({ from: initialDates.from ?? "", to: initialDates.to ?? "" });
  const [guests, setGuests] = useState(initialDates.guests);
  // The suggestion picked for Where; typing again drops it.
  const [picked, setPicked] = useState<Item | null>(hero ? LAUNCH_ITEM : null);
  const [twoMonths, setTwoMonths] = useState(false);
  // The hero asks for the dates before a new trip starts; "Not sure of the dates yet" goes on without.
  const [datesSkipped, setDatesSkipped] = useState(false);
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
  const room = useRoomAboveKeyboard(formRef, open && hero && !sheet);
  // Where the panels open in the flow, under their stops, on a phone.
  const inFlow = bar || sheet;

  // A page asked for a stop: open it, once per request, from the first render too (a phone's
  // sheet mounts for it). Set while rendering, as below.
  const [answered, setAnswered] = useState<number>();
  if (request && request.n !== answered) {
    setAnswered(request.n);
    if (request.panel === "when") setTwoMonths(window.matchMedia(WIDE).matches);
    setPanel(request.panel);
  }
  useEffect(() => {
    if (!request) return;
    const target = request.panel === "where" ? inputRef : request.panel === "when" ? whenRef : guestsRef;
    target.current?.focus({ preventScroll: true });
    // Asked to search: the place's name is selected, so typing replaces it.
    if (request.panel === "where") inputRef.current?.select();
  }, [request]);

  // Only a complete range travels; a half-picked one is dropped, as readTripDates would.
  const dates: TripDates = range.from && range.to ? { ...range, guests } : { guests };
  const carry = tripDatesQuery(dates);

  // A guest with a trip planning (RAA-130): the hero goes on with it, its dates and guests filled
  // in once the trips arrive, unless some were picked first. A trip already under way starts
  // today, by the traveller's own day as well as the API's, so the range never opens on a day
  // that has passed; one that has ended fills none (readTripDates).
  const continuing = useContinueTrip();
  // Set while rendering, once (React's "adjusting state when a prop changes"), not in an effect.
  const [seeded, setSeeded] = useState(false);
  if (hero && continuing && !seeded) {
    setSeeded(true);
    if (!range.from && guests === initialDates.guests) {
      const own = readTripDates({
        from: continuing.starts_on ? latestDay(continuing.starts_on, todayIso(), localTodayIso()) : undefined,
        to: continuing.ends_on ?? undefined,
        guests: String(continuing.guests),
      });
      setRange({ from: own.from ?? "", to: own.to ?? "" });
      setGuests(own.guests);
    }
  }

  // Where still holds the suggestion it was filled with (the hero's launch area from the start),
  // so it offers the popular list again rather than searching for that name.
  const settled = picked !== null && text === picked.title;
  // A settled name is never the query: the hero opens on the launch area's, and searching for
  // it would answer the first key typed over it with results for the old name.
  useEffect(() => {
    if (settled) return;
    const timer = setTimeout(() => setQuery(text.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text, settled]);
  // Characters, not UTF-16 units, to match the API's count (an emoji is one).
  const enabled = !settled && [...query].length >= MIN_LENGTH;
  const { data, isError, refetch } = useQuery({
    queryKey: ["search", query],
    queryFn: () => fetchSearch(query),
    enabled,
    staleTime: 60_000,
  });

  // The destinations Where offers before anything is typed, fetched once it first opens; until
  // they come, the launch area alone.
  const { data: areas } = useQuery({
    queryKey: ["areas"],
    queryFn: fetchAreas,
    enabled: open,
    staleTime: 5 * 60_000,
  });

  const empty = data !== undefined && Object.values(data).every((group) => group.length === 0);
  // Hrefs without the dates: they are added when Search is pressed, so dates picked after the
  // place still travel.
  // The place a typed thing is searched in: the page's. The hero has none: a typed search goes
  // to its one match or the results page (hrefFor). By value: `here` is a new object each render, and the
  // highlight is tied to the list.
  const hereName = here?.name;
  const hereArea = here?.area;
  // On a place's page, the trip shown there: its other places lead the list before typing, so a
  // trip in Bantayan and Cebu City goes from one to the other without typing either.
  const { trip: hereTrip } = useTripHere(hereArea ? [hereArea.slice(1)] : []);
  const workingTrip = hereArea ? hereTrip : undefined;
  // The trip's places lead while Where holds nothing typed: empty, or still the page's own name,
  // which it opens with on a place's page.
  const items = useMemo(() => {
    const own = !enabled || query === hereName ? tripPlaceItems(workingTrip, hereArea, areas) : [];
    const rest = !enabled
      ? popularItems(areas)
      : data
        ? suggestionItems(data, query, hereName && hereArea ? { name: hereName, area: hereArea } : undefined)
        : [];
    return [...own, ...rest];
  }, [enabled, data, query, areas, hereName, hereArea, workingTrip]);
  // Where the hero's Search takes what was typed and not picked, by what it matched: from the
  // results on screen, or (`fetch`, on Search pressed before they came) fetched first.
  const queryClient = useQueryClient();
  const typedHref = (typed: string) => hrefFor(typed, data && enabled && query === typed ? data : undefined);
  async function fetchTypedHref(typed: string) {
    const results = await queryClient
      .fetchQuery({ queryKey: ["search", typed], queryFn: () => fetchSearch(typed), staleTime: 60_000 })
      .catch(() => undefined);
    return hrefFor(typed, results);
  }
  // While a query waits for the debounce, the list it replaces stays shut rather than flicker.
  const typing = !settled && !enabled && [...text.trim()].length >= MIN_LENGTH;
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

  // Fills Where with the suggestion and goes on to the dates, as the bar reads. A search in this
  // place goes at once, as it keeps the dates and guests already set.
  function choose(item: Item) {
    if (item.go) {
      setPanel(null);
      // A trip's place opens on the trip's own dates and guests, already in its href.
      router.push(item.own ? item.href : withDates(item.href, carry));
      onDone?.();
      return;
    }
    setPicked(item);
    // "See all results" keeps what was typed.
    if (item.group) setText(item.title);
    setHighlight(null);
    setTwoMonths(window.matchMedia(WIDE).matches);
    makeRoom("when");
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
      // Close the list first; the next Escape closes the sheet holding it, if any.
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
    if (panel !== next) makeRoom(next);
    setPanel(panel === next ? null : next);
  }

  // The hero's calendar and guests open under its card, which on a laptop's short window sits
  // near the foot of the screen: rather than let the focused day scroll the page just enough to
  // slide the card under the header, the page first moves up by what the panel lacks, at once,
  // and never so far that the card's top passes under the header (html's scroll-pt), so as
  // much of the title as fits stays in view.
  function makeRoom(next: "when" | "guests") {
    const form = formRef.current;
    if (!hero || inFlow || !form) return;
    const need = next === "when" ? WHEN_PANEL_PX : GUESTS_PANEL_PX;
    const rect = form.getBoundingClientRect();
    const short = need - (window.innerHeight - rect.bottom);
    if (short <= 0) return;
    const chrome = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
    window.scrollBy({ top: Math.min(short, rect.top - chrome), behavior: "instant" });
  }

  const input = (
    <input
      ref={inputRef}
      name="q"
      // A text field, not type="search": a search field clears itself on Escape, which in the
      // phone's sheet emptied Where on the way to closing it. The keyboard still offers Search.
      type="text"
      enterKeyHint="search"
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
        if (hero && !sheet && window.matchMedia(PHONE).matches) {
          const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          formRef.current?.scrollIntoView({ block: "start", behavior: smooth ? "smooth" : "auto" });
        }
      }}
      onKeyDown={onKeyDown}
      // The hero's Where left empty starts a trip at the launch area, and its placeholder says so,
      // rather than the field quietly refilling itself.
      placeholder={hero ? LAUNCH_AREA.name : "A place or activity"}
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
        "min-w-0 flex-1 bg-transparent text-base text-foreground caret-primary outline-none selection:bg-fern selection:text-navy placeholder:text-muted/80",
        // On the route the stop gives the field its height.
        hero || bar
          ? "w-full truncate text-title-sm font-bold text-navy placeholder:font-medium placeholder:text-muted"
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
      // On the route it sits on the value's line, so it mustn't make the stop taller.
      className={cn(
        "-mx-1 grid shrink-0 place-items-center rounded-full text-muted transition-colors duration-300 ease-calm hover:bg-surface hover:text-primary focus-visible:outline-2 focus-visible:outline-primary",
        hero || bar ? "-my-3 size-11" : "size-11",
      )}
    >
      <CloseGlyph className="size-4.5" />
    </button>
  );

  const dateLabel = range.from && range.to ? formatDateRange(range.from, range.to) : null;
  // Which of the bar's stops are answered, for its route.
  const whereSet = Boolean(text.trim());
  const dateSet = Boolean(dateLabel);
  // The hero starts a trip at a picked destination or thing to book, or at the launch area when
  // Where is empty (its placeholder says so).
  const role = useSession()?.user.role;
  const traveller = role !== "partner" && role !== "admin";
  const startHref =
    hero && traveller ? (picked ? picked.trip : !text.trim() ? startTripHref(LAUNCH_AREA.slug) : undefined) : undefined;
  const tripHref = startHref;
  const startTrip = useStartTrip();
  const report = useHeroTripReport();
  const trip = tripHref ?? null;
  // The destination the pills open: the one picked in Where, whoever is signed in, as browsing
  // needs no cart; anything else (nothing, a landmark, a search) leaves them on the launch area.
  const areaSlug = picked?.area ?? LAUNCH_AREA.slug;
  const areaName = picked?.area ? picked.title : LAUNCH_AREA.name;
  // Where Search goes with Where as it is: the place picked, or where the typed text matched.
  const typedText = text.trim();
  const search = picked ? picked.href : typedText ? typedHref(typedText) : `/${LAUNCH_AREA.slug}`;
  useEffect(() => {
    report?.({ carry, trip, area: { slug: areaSlug, name: areaName }, where: text.trim(), search });
  }, [report, carry, trip, areaSlug, areaName, text, search]);

  const suggestionsPanel = expanded && (
    <GrowingPanel
      grow={inFlow}
      data-testid="search-suggestions"
      // Keeps focus in the input while a suggestion is clicked: Safari doesn't focus a
      // clicked button, so the form's blur would close the panel before the click lands.
      onMouseDown={(event) => event.preventDefault()}
      // On a phone, only as tall as the room above the on-screen keyboard.
      style={room === null ? undefined : { maxHeight: Math.max(room, MIN_PANEL_PX) }}
      // Its own text colour, as the hero around it is glass.
      className={cn(
        PANEL,
        // Drops in as it opens; the results inside ease up group by group as they come back
        // (Suggestions), on a phone's sheet and under the bar alike.
        "inset-x-0 max-h-[45vh] animate-drop-in overflow-y-auto overscroll-contain search:max-h-[70vh]",
        // Under the bar's Where, which takes part of its row; the hero's Where spans the card,
        // and so does its list, covering the shortcuts under it rather than ending among them.
        bar && "search:right-auto search:w-[min(100%,34rem)]",
        inFlow && cn(IN_SHEET, "max-search:order-2"),
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
        <NoMatches query={query} carry={carry} destinations={areas} className="animate-drop-in p-3 text-sm" />
      ) : (
        <Suggestions id={listId} items={items} active={active} optionId={optionId} query={query} onChoose={choose} />
      )}
    </GrowingPanel>
  );

  const whenPanel = panel === "when" && (
    <div
      id={datesId}
      role="dialog"
      aria-label="Trip dates"
      // Clicks on the calendar's padding keep focus inside the form, so it stays open.
      onMouseDown={keepFocus}
      className={cn(
        PANEL,
        "inset-x-0 flex flex-col gap-2 p-4 search:right-auto search:w-88 lg:w-[40rem]",
        inFlow && cn(IN_SHEET, "max-search:order-4"),
        bar && "search:left-1/4",
      )}
    >
      <DateRangeCalendar
        from={range.from}
        to={range.to}
        onChange={setRange}
        min={todayIso()}
        months={twoMonths ? 2 : 1}
        onComplete={() => {
          // Dates picked: on to the guests, as the bar reads.
          makeRoom("guests");
          setPanel("guests");
          guestsRef.current?.focus();
        }}
      />
      {/* The hero asks for dates before a trip starts; a guest who doesn't know them yet goes
          on to the guests without. */}
      {hero && !range.from && (
        <button
          type="button"
          onClick={() => {
            setDatesSkipped(true);
            makeRoom("guests");
            setPanel("guests");
            guestsRef.current?.focus();
          }}
          data-testid="search-dates-unsure"
          className="self-start text-sm font-semibold text-link underline underline-offset-4 min-h-11"
        >
          Not sure of the dates yet
        </button>
      )}
      <PanelActions
        onClear={range.from ? () => setRange({ from: "", to: "" }) : undefined}
        onDone={() => {
          setPanel(null);
          whenRef.current?.focus();
        }}
      />
    </div>
  );

  const guestsPanel = panel === "guests" && (
    <div
      id={guestsId}
      role="dialog"
      aria-label="Guests"
      onMouseDown={keepFocus}
      className={cn(
        PANEL,
        "inset-x-0 flex flex-col gap-3 p-4 search:right-auto search:left-1/2 search:w-108",
        inFlow && cn(IN_SHEET, "max-search:order-6"),
      )}
    >
      <StepperField
        label="Guests"
        hint={guests >= MAX_GUESTS ? `${MAX_GUESTS} is the most one search takes` : "Everyone on the trip, kids too"}
        value={guests}
        onChange={setGuests}
        min={1}
        max={MAX_GUESTS}
        data-testid="search-guests-count"
      />
      {/* Common group sizes, one tap each; the stepper shows and fine-tunes the count. */}
      <div role="group" aria-label="Group size" className="flex flex-wrap gap-2">
        {GROUP_SIZES.map((size) => (
          <Pill key={size.count} on={guests === size.count} onClick={() => setGuests(size.count)}>
            {size.label}
          </Pill>
        ))}
      </div>
      <PanelActions
        onDone={() => {
          setPanel(null);
          guestsRef.current?.focus();
        }}
      />
    </div>
  );

  return (
    <form
      ref={formRef}
      action="/search"
      role="search"
      className={cn("relative w-full text-left", !hero && "scroll-mt-4", !hero && !bar && "max-w-xl")}
      onKeyDown={onFormKeyDown}
      onSubmit={(event) => {
        const typed = text.trim();
        if (tripHref && !startTrip.asks && !dates.from && !datesSkipped) {
          // A new trip starts with its days: ask once, as a phone's Start your trip does.
          event.preventDefault();
          setTwoMonths(window.matchMedia(WIDE).matches);
          setPanel("when");
          whenRef.current?.focus({ preventScroll: true });
          return;
        } else if (tripHref) {
          event.preventDefault();
          setPanel(null);
          startTrip.start(tripHref, carry);
        } else if (picked) {
          event.preventDefault();
          setPanel(null);
          router.push(withDates(picked.href, carry));
        } else if (here && (!typed || typed === here.name)) {
          event.preventDefault();
          setPanel(null);
          router.push(withDates(here.href, carry), { scroll: false });
        } else if (typed && hero) {
          // Typed, not picked, on the hero: where it matched (typedHref).
          event.preventDefault();
          setPanel(null);
          const ready = data && enabled && query === typed;
          if (ready) router.push(withDates(typedHref(typed), carry));
          else void fetchTypedHref(typed).then((href) => router.push(withDates(href, carry)));
        } else if (typed && hereArea) {
          // Typed, not picked: a place or a place to see named in full goes there; anything else
          // searches the things to book in the page's place.
          event.preventDefault();
          setPanel(null);
          const exact = data && enabled && query === typed ? exactMatch(data, typed) : null;
          router.push(withDates(exact ?? placeSearchHref({ area: hereArea }, typed), carry));
        }
        onDone?.();
      }}
      onBlur={(event) => {
        if (event.currentTarget.contains(event.relatedTarget)) return;
        setPanel(null);
      }}
    >
      {/* What the GET form sends with the query, so Enter and the results page keep them too. */}
      {dates.from && <input type="hidden" name="from" value={dates.from} />}
      {dates.to && <input type="hidden" name="to" value={dates.to} />}
      {guests > 1 && <input type="hidden" name="guests" value={guests} />}

      {hero || bar ? (
        // The route (Search Bar Directions, A2): Where, When and Guests are stops on a dashed
        // path, like a route on the area map. A stop's dot fills once it is answered, the path
        // between two answered stops turns solid, and a missing one asks in blue ("Add dates +").
        // The button sits at the path's end. From sm it runs across a white card; on a phone it
        // runs down: on the hero's card (RAA-130), its panels under the card, and in the bar's
        // sheet, each stop's panel opening under it. A phone on its side keeps the row.
        <div
          className={cn(
            "flex flex-col search:flex-row search:items-stretch search:card-edge search:rounded-card search:bg-surface search:pt-4 search:pr-2.5 search:pb-2.5 search:pl-6",
            hero && !sheet
              ? "card-edge rounded-card bg-surface p-5 pb-4 text-navy shadow-float search:shadow-float landscape-phone:pt-3 landscape-phone:pb-2"
              : hero
                ? "text-navy"
                : "search:shadow-lift",
          )}
        >
          <label className={cn(STOP, "cursor-text max-search:order-1 search:flex-[1.5]", panel === "where" && STOP_ON)}>
            <RouteMark set={whereSet} open={panel === "where"} traced={whereSet && dateSet} />
            {/* It takes a place or a thing ("scooter"), which a typed Search looks for in the place. */}
            <span className={STOP_LABEL}>Where or what</span>
            <span className="flex min-w-0 items-center gap-1">
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
            className={cn(STOP, "cursor-pointer max-search:order-3", panel === "when" && STOP_ON)}
          >
            <RouteMark set={dateSet} open={panel === "when"} traced={dateSet} />
            <span className={STOP_LABEL}>When</span>
            <span className="flex min-w-0 items-center gap-1">
              <span className={cn(STOP_VALUE, !dateSet && STOP_EMPTY)}>{dateLabel ?? "Add dates"}</span>
              <ChevronGlyph direction={panel === "when" ? "up" : "down"} className={STOP_CHEVRON} />
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
            className={cn(STOP, "cursor-pointer max-search:order-5", panel === "guests" && STOP_ON)}
          >
            {/* Guests always holds an answer (Just me), so the path to Search is solid once
                the stops before it are. */}
            <RouteMark set open={panel === "guests"} traced={whereSet && dateSet} last />
            <span className={STOP_LABEL}>Guests</span>
            <span className="flex min-w-0 items-center gap-1">
              <span className={STOP_VALUE}>{guestsLabel(guests)}</span>
              <ChevronGlyph direction={panel === "guests" ? "up" : "down"} className={STOP_CHEVRON} />
            </span>
          </button>
          {inFlow && (
            <>
              {suggestionsPanel}
              {whenPanel}
              {guestsPanel}
            </>
          )}
          {hero ? (
            <Button
              type="submit"
              arrow
              data-testid="search-submit"
              className="shrink-0 max-search:order-7 max-search:mt-1 search:self-center"
            >
              {/* Both labels hold the button's width, so the stops beside it don't jump when
                  typing over the destination turns Start your trip into Search. */}
              <span className="grid justify-items-center">
                {/* The hidden one only holds the width, so a screen reader hears one label. */}
                <span aria-hidden={!tripHref} className={cn("col-start-1 row-start-1", !tripHref && "invisible")}>
                  {startTrip.label}
                </span>
                <span
                  aria-hidden={Boolean(tripHref)}
                  className={cn("col-start-1 row-start-1", tripHref && "invisible")}
                >
                  Search
                </span>
              </span>
            </Button>
          ) : (
            <Button
              type="submit"
              size="pill"
              data-testid="search-submit"
              className="group/go shrink-0 gap-2 max-search:order-7 max-search:mt-1 search:self-center"
            >
              Search
              <ArrowGlyph className="size-4.5 transition-transform duration-300 ease-calm motion-safe:group-hover/go:translate-x-0.5" />
            </Button>
          )}
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

      {!inFlow && (
        <>
          {suggestionsPanel}
          {whenPanel}
          {guestsPanel}
        </>
      )}
    </form>
  );
}

// The suggestions' panel. In a phone's sheet (`grow`) it sits in the flow above When and Guests,
// so its height eases to fit what it holds, from nothing as it opens and again as results come
// back, and the stops under it glide down rather than jump. Over the page (wider screens, the
// hero) its height is left alone.
function GrowingPanel({ grow, style, className, children, ...props }: ComponentProps<"div"> & { grow: boolean }) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | null>(() => (grow && window.matchMedia(PHONE).matches ? 0 : null));
  useEffect(() => {
    const inner = innerRef.current;
    if (!grow || !inner) return;
    const phone = window.matchMedia(PHONE);
    // The panel's 1px border, top and bottom.
    const observer = new ResizeObserver(() => setHeight(phone.matches ? inner.offsetHeight + 2 : null));
    observer.observe(inner);
    return () => observer.disconnect();
  }, [grow]);
  return (
    <div
      {...props}
      style={height === null ? style : { ...style, height }}
      className={cn(className, grow && "max-search:transition-[height] max-search:duration-300 max-search:ease-calm")}
    >
      <div ref={innerRef} className="p-2">
        {children}
      </div>
    </div>
  );
}

// The panels under the route: suggestions, the calendar, the guests.
const PANEL = "absolute right-0 top-full z-20 mt-2 card-edge rounded-card bg-surface text-foreground shadow-lift";
// On a phone the bar lives in a sheet, so its panels open in the flow, under the fields,
// where the sheet scrolls to them.
const IN_SHEET = "max-search:static max-search:shadow-none";
// A stop on the bar's route: its dot and path (RouteMark), its word, then its value. Across from
// sm, the dot sits over the word and the path runs right to the next stop; down on a phone, the
// dot sits beside the word and the path runs down to the next.
// Each stop is a control, so it tints like a field on hover, on focus and while its panel is open
// (STOP_ON), behind its dot and words.
const STOP =
  "group/stop relative isolate flex min-w-0 flex-col gap-px text-left focus-visible:outline-none max-search:pb-4 max-search:pl-7.5 search:flex-1 search:pt-8 search:pr-4 search:pb-2 before:absolute before:-inset-x-2 before:inset-y-0 before:-z-10 before:rounded-control before:bg-mist before:opacity-0 before:transition-opacity before:duration-300 before:ease-calm hover:before:opacity-100 focus-visible:before:opacity-100 focus-within:before:opacity-100";
const STOP_ON = "before:opacity-100";
// The chevron after a stop's value, saying it opens; it turns up while open.
const STOP_CHEVRON =
  "size-4 shrink-0 text-muted transition-colors duration-300 ease-calm group-hover/stop:text-primary";
const STOP_LABEL = "text-small font-bold text-muted";
const STOP_VALUE =
  "truncate text-title-sm font-bold text-navy underline-offset-4 decoration-2 group-focus-visible/stop:underline group-focus-visible/stop:decoration-primary";
// What a stop still needs, in blue, with a plus: "Add dates +".
const STOP_EMPTY = "text-primary after:content-['_+']";

// A stop's dot, and the path from it to the next stop (or, for the last, to Search): dashed
// until both ends are answered, then solid navy. The open stop's dot is blue and ringed.
function RouteMark({
  set,
  open,
  traced,
  last = false,
}: {
  set: boolean;
  open: boolean;
  traced: boolean;
  last?: boolean;
}) {
  return (
    <>
      <span
        aria-hidden
        className={cn(
          "absolute left-0 size-4 rounded-full border-2 transition-[background-color,border-color,box-shadow] duration-300 ease-calm max-search:top-0.5 search:top-1",
          open
            ? "border-primary bg-primary ring-4 ring-sky-mist"
            : set
              ? "border-navy bg-navy"
              : "border-line-strong bg-surface",
        )}
      />
      <span
        aria-hidden
        className={cn(
          "absolute transition-colors duration-300 ease-calm max-search:top-6 max-search:bottom-0 max-search:left-1.75 max-search:border-l-2 search:top-2.75 search:right-2 search:left-6 search:border-t-2",
          traced ? "border-solid border-navy" : "border-dashed border-line-strong",
          // On a phone the last stop's path would run into the button.
          last && "max-search:hidden",
        )}
      />
    </>
  );
}

function PanelActions({ onClear, onDone }: { onClear?: () => void; onDone: () => void }) {
  return (
    <div className="flex items-center justify-end gap-1 text-sm">
      {onClear && (
        <button
          type="button"
          onClick={onClear}
          className="mr-auto rounded-control px-3 py-2 font-medium text-link hover:bg-surface-2"
        >
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

// `area`: a destination's slug, so the hero's shortcuts can open it. `trip`: where the hero's
// button starts a trip with it picked: a destination's things to book, or a thing to book's own
// row on its destination's page.
// `go`: opens at once rather than filling Where (a search in this place, a trip's place).
// `own`: its href carries its own dates (a trip's place, on the trip's), not the search's.
type Item = {
  group: string;
  href: string;
  icon: ReactNode;
  title: string;
  note?: string;
  area?: string;
  trip?: string;
  go?: boolean;
  own?: boolean;
};

// The trip's other places, on its dates: "In your trip" before anything is typed.
function tripPlaceItems(trip: Trip | undefined, hereArea: string | undefined, areas: AreaCard[] | undefined): Item[] {
  if (!trip) return [];
  const dates = tripOwnQuery(trip);
  return tripPlaces(trip)
    .filter((place) => `/${place.slug}` !== hereArea)
    .map((place) => {
      const kind = areas?.find((area) => area.slug === place.slug)?.kind;
      return {
        group: "In your trip",
        href: `/${place.slug}${dates}`,
        icon: kind ? areaIcon(kind) : placeIcon(),
        title: place.name,
        note: `${thingCount(place.count)} · ${formatDateRange(trip.starts_on, trip.ends_on) ?? "No dates yet"}`,
        area: place.slug,
        go: true,
        own: true,
      };
    });
}

// A search in the page's place: its What to book, narrowed to what was typed.
function placeSearchHref(here: { area: string }, typed: string) {
  return `${here.area}?q=${encodeURIComponent(typed)}#listings`;
}

const LAUNCH_ITEM: Item = {
  group: "Destinations",
  href: `/${LAUNCH_AREA.slug}`,
  icon: areaIcon(LAUNCH_AREA.kind),
  title: LAUNCH_AREA.name,
  note: "Beaches, island hopping and local partners",
  area: LAUNCH_AREA.slug,
  trip: startTripHref(LAUNCH_AREA.slug),
};

// Before anything is typed: the destinations, as the home page's cards group them (a town in its
// island's), most to book first; the launch area alone until they have loaded.
function popularItems(areas: AreaCard[] | undefined): Item[] {
  if (!areas?.length) return [LAUNCH_ITEM];
  return groupDestinations(areas).map(({ area, subAreas }) => ({
    group: "Destinations",
    href: `/${area.slug}`,
    icon: areaIcon(area.kind),
    title: area.name,
    note: countLine(withSubAreas(area, subAreas)) || area.parent_name || undefined,
    area: area.slug,
    trip: startTripHref(area.slug),
  }));
}

// A destination or a place to see whose name is exactly what was typed ("Kota Beach"): its page,
// or its card on its destination's page, rather than a search of the things to book for its name.
function exactMatch(results: SearchResults, typed: string) {
  const same = (name: string) => name.localeCompare(typed, undefined, { sensitivity: "base" }) === 0;
  const area = results.areas.find((each) => same(each.name));
  if (area) return `/${area.slug}`;
  const landmark = results.landmarks.find((each) => same(each.name));
  return landmark ? `/${landmark.area.slug}#${landmark.slug}` : null;
}

async function fetchSearch(q: string) {
  const { data, error } = await apiClient().GET("/api/v1/search", { params: { query: { q } } });
  if (error || !data) throw new Error("Search failed");
  return data;
}

async function fetchAreas() {
  const { data, error } = await apiClient().GET("/api/v1/areas");
  if (error || !data) throw new Error("Couldn't load destinations");
  return data;
}

// What the hero's Search opens for a typed search: its one match (a destination, a place to see,
// an activity's results or a thing to book's row), else the results page, which lays out several,
// says when there are none and explains a search too short to run.
function hrefFor(typed: string, results: SearchResults | undefined) {
  const all = `/search?q=${encodeURIComponent(typed)}`;
  if (!results || [...typed].length < MIN_LENGTH) return all;
  // The matches, then "Search all places".
  const items = suggestionItems(results, typed);
  return items.length === 2 ? items[0].href : all;
}

// Every suggestion in display order, ending with "See all results", so the arrow keys and
// the list agree on one index. With the page's place to search in the first is a search there,
// and the last says it searches every place.
function suggestionItems(results: SearchResults, query: string, here?: { name: string; area: string }): Item[] {
  return [
    ...(here
      ? [
          {
            group: `On ${here.name}`,
            href: placeSearchHref(here, query),
            icon: <SearchGlyph className="size-[1.1em]" />,
            title: `Things to book matching “${query}”`,
            note: "Searches this page",
            go: true,
          },
        ]
      : []),
    ...results.areas.map((area) => ({
      group: "Destinations",
      href: `/${area.slug}`,
      icon: areaIcon(area.kind),
      title: area.name,
      note: area.parent_name ?? undefined,
      area: area.slug,
      trip: startTripHref(area.slug),
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
      trip: `/${listing.area_slug}?start=trip#listing-${listing.id}`,
    })),
    {
      group: "",
      href: `/search?q=${encodeURIComponent(query)}`,
      icon: <SearchGlyph className="size-[1.1em]" />,
      title: `Search all places for “${query}”`,
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
    <div id={id} role="listbox" aria-label="Suggestions" className="flex flex-col results-in">
      {groups.map((group) => (
        // "See all results" closes the list below a divider.
        <ul
          key={group || "all"}
          role="group"
          aria-label={group || undefined}
          className={cn(!group && "mt-1.5 border-t border-line pt-1.5")}
        >
          {group && (
            <li role="presentation" className="px-3 pb-1.5 pt-3 text-small font-bold text-muted">
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
                    {item.note && <span className="block truncate text-small text-muted">{item.note}</span>}
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

// The latest of some "YYYY-MM-DD" days, which sort as text.
function latestDay(...days: string[]) {
  return days.reduce((latest, day) => (day > latest ? day : latest));
}
