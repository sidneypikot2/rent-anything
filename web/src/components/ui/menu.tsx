"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "./cn";

export type MenuItem = {
  label: string;
  // A short second line: "Moves every item into it".
  detail?: string;
  // Either a page to open or something to do.
  href?: string;
  onSelect?: () => void;
  danger?: boolean;
  "data-testid"?: string;
};

type Props = {
  // What the ⋯ button is for, for screen readers: "Actions for Island hopping".
  label: string;
  items: MenuItem[];
  // "dark" for a ⋯ on a forest or navy surface (the cart's trip header).
  tone?: "light" | "dark";
  "data-testid"?: string;
};

const ITEM = "block w-full px-4 py-2 text-left hover:bg-surface-2";

// A ⋯ button opening a short list of actions on one thing (an item, a trip). A plain
// disclosure like the account menu, not an ARIA menu widget: it closes on Escape, on a
// click outside it and once an action is picked.
export function Menu({ label, items, tone = "light", "data-testid": testId }: Props) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      trigger.current?.focus();
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        ref={trigger}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={listId}
        data-testid={testId}
        onClick={() => setOpen(!open)}
        className={cn(
          "flex size-9 items-center justify-center rounded-control text-xl leading-none transition-colors",
          tone === "dark"
            ? cn("text-sky-mist hover:bg-glass-hover hover:text-white", open && "bg-glass-hover text-white")
            : cn("text-muted hover:bg-surface-2 hover:text-primary", open && "bg-surface-2 text-primary"),
        )}
      >
        ⋯
      </button>
      {open && (
        <ul
          id={listId}
          className="absolute right-0 top-full z-20 mt-1 w-60 overflow-hidden card-edge rounded-card bg-surface py-1 text-sm shadow-lift"
        >
          {items.map((item) => {
            const content = (
              <>
                <span className={cn("font-medium", item.danger ? "text-danger" : "text-foreground")}>{item.label}</span>
                {item.detail && <span className="block text-xs text-muted">{item.detail}</span>}
              </>
            );
            return (
              <li key={item.label}>
                {item.href ? (
                  <Link href={item.href} data-testid={item["data-testid"]} className={ITEM} onClick={() => setOpen(false)}>
                    {content}
                  </Link>
                ) : (
                  <button
                    type="button"
                    data-testid={item["data-testid"]}
                    className={ITEM}
                    onClick={() => {
                      setOpen(false);
                      item.onSelect?.();
                    }}
                  >
                    {content}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
