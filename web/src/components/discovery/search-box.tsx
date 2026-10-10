"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { Button } from "@/components/ui/button";
import type { SearchResults } from "@/api/discovery";
import { areaIcon, tagIcon } from "./icons";

const MIN_LENGTH = 2;
const DEBOUNCE_MS = 250;

// The hero search: destinations, landmarks, activities and things to book as you type.
// It is a plain GET form, so Enter (or no JavaScript) opens the full results at /search.
export function SearchBox({ initialQuery = "" }: { initialQuery?: string }) {
  const [text, setText] = useState(initialQuery);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const listId = useId();

  useEffect(() => {
    const timer = setTimeout(() => setQuery(text.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text]);

  // Characters, not UTF-16 units, to match the API's count (an emoji is one).
  const enabled = [...query].length >= MIN_LENGTH;
  const { data, isError } = useQuery({
    queryKey: ["search", query],
    queryFn: async () => {
      const { data, error } = await apiClient().GET("/api/v1/search", { params: { query: { q: query } } });
      if (error || !data) throw new Error("Search failed");
      return data;
    },
    enabled,
    staleTime: 60_000,
  });

  const showPanel = open && enabled && (isError || data !== undefined);

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
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpen(false);
          }}
          placeholder="Try Bantayan or snorkelling"
          aria-label="Search destinations, landmarks and activities"
          aria-controls={listId}
          autoComplete="off"
          minLength={MIN_LENGTH}
          required
          data-testid="search-input"
          className="min-w-0 flex-1 bg-transparent py-2 text-base text-foreground outline-none placeholder:text-muted/80"
        />
        <Button type="submit" className="shrink-0">
          Search
        </Button>
      </div>

      {showPanel && (
        <div
          id={listId}
          data-testid="search-suggestions"
          // Keeps focus in the input while a suggestion is clicked: Safari doesn't focus a
          // clicked link, so the form's blur would close the panel before the click lands.
          onMouseDown={(event) => event.preventDefault()}
          className="absolute inset-x-0 top-full z-20 mt-2 max-h-[70vh] overflow-y-auto rounded-2xl border-[1.5px] border-line bg-surface p-2 shadow-xl shadow-primary/10"
        >
          {isError ? (
            <p className="p-3 text-sm text-muted">Search isn&apos;t available right now.</p>
          ) : (
            data && <Suggestions results={data} query={query} />
          )}
        </div>
      )}
    </form>
  );
}

function Suggestions({ results, query }: { results: SearchResults; query: string }) {
  const empty = Object.values(results).every((group) => group.length === 0);
  if (empty) return <p className="p-3 text-sm text-muted">Nothing matches “{query}” yet.</p>;

  return (
    <div className="flex flex-col gap-1">
      <Group title="Destinations">
        {results.areas.map((area) => (
          <Suggestion
            key={area.slug}
            href={`/${area.slug}`}
            icon={areaIcon(area.kind)}
            title={area.name}
            note={area.parent_name ?? undefined}
          />
        ))}
      </Group>
      <Group title="Landmarks">
        {results.landmarks.map((landmark) => (
          <Suggestion
            key={landmark.slug}
            href={`/${landmark.area.slug}#${landmark.slug}`}
            icon="📍"
            title={landmark.name}
            note={landmark.area.name}
          />
        ))}
      </Group>
      <Group title="Activities & interests">
        {results.tags.map((tag) => (
          <Suggestion
            key={tag.slug}
            href={`/search?q=${encodeURIComponent(tag.name)}`}
            icon={tagIcon(tag.slug)}
            title={tag.name}
            note={tag.areas.map((area) => area.name).join(", ")}
          />
        ))}
      </Group>
      <Group title="Things to book">
        {results.listings.map((listing) => (
          <Suggestion
            key={listing.id}
            href={`/${listing.area_slug}#listings`}
            icon="🎟️"
            title={listing.title}
            note={listing.category}
          />
        ))}
      </Group>
      <Link
        href={`/search?q=${encodeURIComponent(query)}`}
        className="rounded-lg px-3 py-2 text-sm font-semibold text-link hover:bg-surface-2"
      >
        See all results for “{query}” →
      </Link>
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode[] }) {
  if (children.length === 0) return null;
  return (
    <div>
      <p className="px-3 pb-1 pt-2 text-[0.65rem] font-bold uppercase tracking-wider text-muted">{title}</p>
      <ul>{children}</ul>
    </div>
  );
}

function Suggestion({ href, icon, title, note }: { href: string; icon: string; title: string; note?: string }) {
  return (
    <li>
      <Link href={href} className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-surface-2 focus:bg-surface-2 focus:outline-none">
        <span aria-hidden className="text-lg">
          {icon}
        </span>
        <span className="min-w-0">
          <span className="block truncate font-medium text-foreground">{title}</span>
          {note && <span className="block truncate text-xs text-muted">{note}</span>}
        </span>
      </Link>
    </li>
  );
}
