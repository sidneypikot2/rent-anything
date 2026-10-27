"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

// `trip`: the search was opened for that trip (its "+ Another place"), so the place it goes to
// shows the trip; a search opened any other way leaves the trip behind.
export type EditOptions = { trip?: number };
type EditSearch = (panel: "where" | "when" | "guests", options?: EditOptions) => void;

// The place the page is about, for the search in the header (RAA-126), which sits in the layout
// and so can't be handed it. A page names it by rendering <CurrentPlace>, with the area's slug,
// so a search typed there stays in that area (its page, `?q=`). `searching`: the page has a
// search (its PageBanner rendered <SearchBar>). The header's search registers how to open its
// dates or guests, so a page's own summary of them can hand the change to it rather than keep a
// second form (the area page's trip line).
type Place = { name: string; slug: string };

const PlaceContext = createContext<{
  place: Place | null;
  set: (place: Place | null) => void;
  searching: boolean;
  setSearching: (searching: boolean) => void;
  edit: EditSearch | null;
  setEdit: (edit: EditSearch | null) => void;
}>({ place: null, set: () => {}, searching: false, setSearching: () => {}, edit: null, setEdit: () => {} });

export function CurrentPlaceProvider({ children }: { children: ReactNode }) {
  const [place, set] = useState<Place | null>(null);
  const [searching, setSearching] = useState(false);
  const [edit, setEditState] = useState<EditSearch | null>(null);
  // A function in state has to be wrapped, or React calls it as an updater.
  const setEdit = useCallback((next: EditSearch | null) => setEditState(() => next), []);
  return (
    <PlaceContext value={{ place, set, searching, setSearching, edit, setEdit }}>{children}</PlaceContext>
  );
}

// A page with a search says so; the header shows it while one is mounted.
export function SearchHere() {
  const { setSearching } = useContext(PlaceContext);
  useEffect(() => {
    setSearching(true);
    return () => setSearching(false);
  }, [setSearching]);
  return null;
}

export function usePageSearching() {
  return useContext(PlaceContext).searching;
}

export function CurrentPlace({ name, slug }: Place) {
  const { set } = useContext(PlaceContext);
  useEffect(() => {
    set({ name, slug });
    return () => set(null);
  }, [name, slug, set]);
  return null;
}

export function useCurrentPlace() {
  return useContext(PlaceContext).place;
}

// For the header's search: open its dates or guests on request. Null while the page has none.
export function useRegisterEditSearch(edit: EditSearch, on: boolean) {
  const { setEdit } = useContext(PlaceContext);
  const ref = useRef(edit);
  useEffect(() => {
    ref.current = edit;
  });
  useEffect(() => {
    if (!on) return;
    setEdit((panel, options) => ref.current(panel, options));
    return () => setEdit(null);
  }, [setEdit, on]);
}

export function useEditSearch() {
  return useContext(PlaceContext).edit;
}
