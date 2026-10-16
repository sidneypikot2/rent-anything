"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

// The place the page is about, for the search bar under the header (RAA-126), which sits in
// the layout and so can't be handed it. A page names it by rendering <CurrentPlace>.
const PlaceContext = createContext<{ name: string | null; set: (name: string | null) => void }>({
  name: null,
  set: () => {},
});

export function CurrentPlaceProvider({ children }: { children: ReactNode }) {
  const [name, set] = useState<string | null>(null);
  return <PlaceContext value={{ name, set }}>{children}</PlaceContext>;
}

export function CurrentPlace({ name }: { name: string }) {
  const { set } = useContext(PlaceContext);
  useEffect(() => {
    set(name);
    return () => set(null);
  }, [name, set]);
  return null;
}

export function useCurrentPlace() {
  return useContext(PlaceContext).name;
}
