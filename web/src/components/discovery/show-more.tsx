"use client";

import { useId, useState, type ReactNode } from "react";

// More of a list behind a button that stays below it, so opening it never moves the button
// out from under the pointer (a <details> summary has to come first).
export function ShowMore({ more, less, children }: { more: string; less: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <>
      <div id={id} hidden={!open}>
        {children}
      </div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
        className="inline-flex min-h-11 items-center self-start rounded-full px-1 font-semibold text-link"
      >
        {open ? less : more}
      </button>
    </>
  );
}
