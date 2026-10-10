"use client";

import { useEffect, useId, useMemo, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import type { SearchResults } from "@/api/discovery";
import { areaIcon, tagIcon } from "./icons";

const MIN_LENGTH = 2;
const DEBOUNCE_MS = 250;

// The hero search: destinations, landmarks, activities and things to book as you type.
// It is a plain GET form, so Enter (or no JavaScript) opens the full results at /search,
// which also explains a query that is too short. The suggestions follow the ARIA combobox
// pattern (as ComboboxField does, RAA-75): arrow keys move through them, Enter opens the
// highlighted one, Escape closes the list.
export function SearchBox({ initialQuery = "" }: { initialQuery?: string }) {
  const router = useRouter();
  const [text, setText] = useState(initialQuery);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  // The highlighted suggestion, tied to the list it was picked in: new results start with
  // nothing highlighted, so the highlight never points at another item or past the list.
  const [highlight, setHighlight] = useState<{ items: Item[]; index: number } | null>(null);
  const listId = useId();

  useEffect(() => {
    const timer = setTimeout(() => setQuery(text.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text]);

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
  const items = useMemo(() => (data ? suggestionItems(data, query) : []), [data, query]);
  const expanded = open && enabled;
  // The keys only move through a list that is on screen.
  const listed = expanded && !isError && data !== undefined && !empty;
  const active = listed && highlight?.items === items ? highlight.index : -1;
  const moveTo = (index: number) => setHighlight({ items, index });
  const optionId = (index: number) => `${listId}-${index}`;

  useEffect(() => {
    if (active >= 0) document.getElementById(optionId(active))?.scrollIntoView({ block: "nearest" });
    // optionId only depends on listId, which never changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

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
      setOpen(false);
      router.push(items[active].href);
    } else if (event.key === "Escape" && expanded) {
      // Close the list first; the browser's own clear of a search field waits for the next Escape.
      event.preventDefault();
      setOpen(false);
      setHighlight(null);
    }
  }

  return (
    <form
      action="/search"
      role="search"
      className="relative w-full max-w-xl text-left"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <div className="flex items-center gap-2 rounded-2xl border-[1.5px] border-line-strong bg-surface p-1.5 pl-4 shadow-lg shadow-primary/10 focus-within:border-primary">
        <input
          name="q"
          type="search"
          role="combobox"
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setOpen(true);
            setHighlight(null);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Try Bantayan or snorkelling"
          aria-label="Search destinations, landmarks and activities"
          aria-autocomplete="list"
          aria-expanded={expanded}
          aria-controls={expanded ? listId : undefined}
          aria-activedescendant={expanded && active >= 0 ? optionId(active) : undefined}
          autoComplete="off"
          data-testid="search-input"
          className="min-w-0 flex-1 bg-transparent py-2 text-base text-foreground outline-none placeholder:text-muted/80"
        />
        <Button type="submit" className="shrink-0">
          Search
        </Button>
      </div>

      {expanded && (
        <div
          data-testid="search-suggestions"
          // Keeps focus in the input while a suggestion is clicked: Safari doesn't focus a
          // clicked link, so the form's blur would close the panel before the click lands.
          onMouseDown={(event) => event.preventDefault()}
          // Short enough on a phone to stay above the on-screen keyboard.
          className="absolute inset-x-0 top-full z-20 mt-2 max-h-[45vh] overflow-y-auto rounded-2xl border-[1.5px] border-line bg-surface p-2 shadow-xl shadow-primary/10 sm:max-h-[70vh]"
        >
          {isError ? (
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
            <p role="status" className="p-3 text-sm text-muted">
              Nothing matches “{query}” yet.
            </p>
          ) : (
            <Suggestions id={listId} items={items} active={active} optionId={optionId} />
          )}
        </div>
      )}
    </form>
  );
}

type Item = { group: string; href: string; icon: string; title: string; note?: string };

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
      icon: "📍",
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
      href: `/${listing.area_slug}#listings`,
      icon: "🎟️",
      title: listing.title,
      note: listing.category,
    })),
    { group: "", href: `/search?q=${encodeURIComponent(query)}`, icon: "", title: `See all results for “${query}” →` },
  ];
}

function Suggestions({
  id,
  items,
  active,
  optionId,
}: {
  id: string;
  items: Item[];
  active: number;
  optionId: (index: number) => string;
}) {
  const groups = [...new Set(items.map((item) => item.group))];
  return (
    <div id={id} role="listbox" aria-label="Suggestions" className="flex flex-col gap-1">
      {groups.map((group) => (
        <ul key={group || "all"} role="group" aria-label={group || undefined}>
          {group && (
            <li role="presentation" className="px-3 pb-1 pt-2 text-xs font-bold uppercase tracking-wider text-muted">
              {group}
            </li>
          )}
          {items.map((item, index) =>
            item.group === group ? (
              <li key={item.href + index} role="presentation">
                <Link
                  id={optionId(index)}
                  role="option"
                  aria-selected={index === active}
                  tabIndex={-1}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-surface-2",
                    index === active && "bg-surface-2",
                    !item.group && "text-sm font-semibold text-link",
                  )}
                >
                  {item.icon && (
                    <span aria-hidden className="text-lg">
                      {item.icon}
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className={cn("block truncate", item.group && "font-medium text-foreground")}>{item.title}</span>
                    {item.note && <span className="block truncate text-xs text-muted">{item.note}</span>}
                  </span>
                </Link>
              </li>
            ) : null,
          )}
        </ul>
      ))}
    </div>
  );
}
