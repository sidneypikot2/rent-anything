"use client";

import Link from "next/link";
import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "./cn";

export type MenuItem = {
  label: string;
  // A short second line: "Moves every item into it".
  detail?: string;
  // A line icon (tag-glyphs), shown in a tinted well beside the label.
  icon?: ReactNode;
  // Either a page to open or something to do.
  href?: string;
  onSelect?: () => void;
  // Destructive: set apart under a divider, its well and label in the danger colour.
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

// One look for every dropdown menu (this one and the header's AccountMenu, 2026-10-29): a white
// card, 44px rows with a plain lagoon icon and a medium label, tinting mist on hover and focus
// inside the card's 8px inset. Its type is set here (16px, medium), not inherited: the header's
// nav is text-sm, which made the account menu smaller than the ⋯ menu.
// MENU_SURFACE is the card alone, for a list as wide as what it hangs from (a field's suggestions).
export const MENU_SURFACE = "card-edge rounded-card bg-surface p-2 text-base font-medium shadow-lift";
export const MENU_PANEL = `w-72 ${MENU_SURFACE}`;
// A destructive row (Remove, Sign out): red, with a red tint on hover and focus.
export const MENU_DANGER = "text-danger hover:bg-danger/5 focus-visible:bg-danger/5";
export const MENU_ROW =
  "flex min-h-11 w-full items-center gap-3 rounded-control px-3 text-left font-medium transition-colors duration-300 ease-calm hover:bg-mist focus-visible:bg-mist";
// The icon's size; its colour is text-primary (text-danger on a destructive row).
export const MENU_ICON = "size-5 shrink-0";
export const MENU_DIVIDER = "mx-1 my-1 border-t border-line";

// Room the list needs below its button before it opens upward instead.
const ROOM_BELOW = 280;

// A ⋯ button opening a short list of actions on one thing (an item, a trip). A plain
// disclosure like the account menu, not an ARIA menu widget: it closes on Escape, on a click
// outside it, on scrolling and once an action is picked. The list is a popover in the browser's
// top layer, placed beside its button, so no sticky bar or card around it can cover it (the
// cart's send foot did), and it opens upward when the window has no room below. It looks like
// the account menu (MENU_ROW above); a destructive action comes last, in red, under a divider.
export function Menu({ label, items, tone = "light", "data-testid": testId }: Props) {
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState<CSSProperties>({});
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const listId = useId();

  useLayoutEffect(() => {
    const popover = list.current;
    const button = trigger.current;
    if (!open || !popover || !button) return;
    const box = button.getBoundingClientRect();
    const right = Math.max(8, window.innerWidth - box.right);
    setPlace(
      window.innerHeight - box.bottom < ROOM_BELOW && box.top > ROOM_BELOW
        ? { right, bottom: window.innerHeight - box.top + 6 }
        : { right, top: box.bottom + 6 },
    );
    if (!popover.matches(":popover-open")) popover.showPopover();
  }, [open]);

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
    // Placed once, against the window: a scroll would leave it behind its button.
    function onScroll(event: Event) {
      if (!list.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open]);

  const safe = items.filter((item) => !item.danger);
  const danger = items.filter((item) => item.danger);
  const row = (item: MenuItem) => {
    const content = (
      <>
        {item.icon && (
          <span aria-hidden className={cn(MENU_ICON, "flex items-center justify-center [&>svg]:size-5", item.danger ? "text-danger" : "text-primary")}>
            {item.icon}
          </span>
        )}
        <span className="flex min-w-0 flex-col">
          <span className={item.danger ? "text-danger" : "text-foreground"}>{item.label}</span>
          {item.detail && <span className="text-sm font-normal text-muted">{item.detail}</span>}
        </span>
      </>
    );
    const rowClass = cn(MENU_ROW, item.detail && "py-2", item.danger && MENU_DANGER);
    return (
      <li key={item.label}>
        {item.href ? (
          <Link href={item.href} data-testid={item["data-testid"]} className={rowClass} onClick={() => setOpen(false)}>
            {content}
          </Link>
        ) : (
          <button
            type="button"
            data-testid={item["data-testid"]}
            className={rowClass}
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
  };

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
          "tap-target flex size-9 items-center justify-center rounded-control text-xl leading-none transition-colors",
          tone === "dark"
            ? cn("text-sky-mist hover:bg-glass-hover hover:text-white", open && "bg-glass-hover text-white")
            : cn("text-muted hover:bg-surface-2 hover:text-primary", open && "bg-action-tint text-action-ink"),
        )}
      >
        ⋯
      </button>
      {open && (
        <ul
          ref={list}
          id={listId}
          popover="manual"
          style={place}
          className={cn(MENU_PANEL, "fixed inset-auto m-0 flex flex-col text-foreground motion-safe:animate-drop-in")}
        >
          {safe.map(row)}
          {danger.length > 0 && safe.length > 0 && <li aria-hidden className={MENU_DIVIDER} />}
          {danger.map(row)}
        </ul>
      )}
    </div>
  );
}
