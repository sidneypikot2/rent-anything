"use client";

import { useId, useState, type ReactNode } from "react";
import { cn } from "@/components/ui/cn";
import { glassClasses } from "@/components/ui/glass";

// More of a list behind a button that stays below it, so opening it never moves the button
// out from under the pointer (a <details> summary has to come first). `glass` draws the button
// as a glass pill, for a section over the photo (the home page's activities, RAA-130).
export function ShowMore({
  more,
  less,
  glass = false,
  children,
}: {
  more: string;
  less: string;
  glass?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <>
      <div id={id} hidden={!open}>
        {children}
      </div>
      {/* As a link, its padding rounds the focus ring and the negative margin keeps the words on
          the cards' edge. */}
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
        className={cn(
          "inline-flex min-h-11 items-center self-start rounded-full font-semibold",
          glass
            ? cn(glassClasses("dark"), "px-4 text-sm font-bold text-white hover:bg-glass-hover active:scale-[0.97]")
            : "-mx-1 px-1 text-link",
        )}
      >
        {open ? less : more}
      </button>
    </>
  );
}
