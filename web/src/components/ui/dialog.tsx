"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { AlertGlyph, CloseGlyph } from "@/components/discovery/tag-glyphs";
import { Button } from "./button";
import { cn } from "./cn";

// Every dialog is one anatomy (the modal redesign, 2026-10-28): a grab handle on a phone, a
// header that names the thing (title, an optional one-line `meta`, an optional `thumb`) with the
// close disc, the body, and an action bar pinned to the foot holding an optional `summary` (a
// total, what the button will do) and the actions. On a phone the dialog docks to the bottom
// and can be dragged down to close; from sm it is a centred card. A side panel and the drawer
// keep their places but share the close disc and action bar.
//
// Closing (2026-10-29, the team's pick after RAA-194): a click outside, Escape, a drag down or
// the close disc all close a dialog, as on iOS and Android, unless it is `dirty` (a form holding
// changes): then any of them asks "Discard changes?" first. Only a click pressed and released
// outside counts, so a selection or a press that slid out (a button that moved) never closes one.
const PLACEMENTS = {
  // A confirmation or short step: docked on a phone like a sheet, a narrower card from sm.
  center:
    "mx-0 mb-0 mt-auto max-h-[90dvh] w-full max-w-none rounded-t-frame sm:m-auto sm:w-[calc(100%-2rem)] sm:max-w-md sm:rounded-frame",
  // A step in a flow (adding, editing, choosing): docked on a phone, centred from sm.
  sheet:
    "mx-0 mb-0 mt-auto max-h-[90dvh] w-full max-w-none rounded-t-frame sm:m-auto sm:w-[calc(100%-2rem)] sm:max-w-lg sm:rounded-frame",
  // A floating panel on the right, 12px in from the window's edges (RAA-126): `media` leads,
  // the title under it with the details, `actions` pinned at the foot and what's between
  // scrolling; the close disc floats at the top right.
  side: "my-3 mr-3 ml-auto h-[calc(100dvh-1.5rem)] max-h-[calc(100dvh-1.5rem)] w-[calc(100%-1.5rem)] max-w-md rounded-card",
  // A sheet from the bottom on a phone, in thumb's reach, and the side panel from sm: up, for a
  // guide to the page under it (the trip's plan). The title and close disc stay at its top and
  // only the body scrolls, so nothing floats over the text.
  drawer:
    "mx-0 mb-0 mt-auto max-h-[88dvh] w-full max-w-none rounded-t-frame sm:my-3 sm:mr-3 sm:ml-auto sm:h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-1.5rem)] sm:w-[calc(100%-1.5rem)] sm:max-w-md sm:rounded-card",
  // Centred and wider, for the whole of a record on a work screen: the title and close disc
  // stay at the top and `actions` at the foot, and what's between scrolls.
  overlay: "m-auto max-h-[calc(100dvh-3rem)] w-[calc(100%-2rem)] max-w-2xl overflow-hidden rounded-card",
};

// Docked to the bottom on a phone: these get the grab handle and drag-to-close.
const DOCKED = new Set<keyof typeof PLACEMENTS>(["center", "sheet", "drawer"]);
// How far a drag down must go before letting go closes it.
const DRAG_CLOSE = 90;

type Props = {
  open: boolean;
  onClose: () => void;
  // What the dialog is about (the listing, the trip, the question), never the action's name:
  // the action is said once, on its button.
  title: string;
  // One quiet line under the title ("Tour · Kota Beach Boat Tours", "For Oct 28 · 2 guests").
  meta?: ReactNode;
  // A small picture beside the title (a listing's photo or its category icon), for a sheet.
  thumb?: ReactNode;
  children?: ReactNode;
  // A side panel's photo, above its title.
  media?: ReactNode;
  // The buttons along the bottom, the confirming one last. A sheet whose buttons sit inside
  // its own form passes them as `footer` instead (they must be inside the form to submit it).
  actions?: ReactNode;
  // What the actions come to, left of them in the action bar: a total, a count, a hint.
  summary?: ReactNode;
  // "danger": a confirmation that can't be undone; an alert disc leads the title.
  tone?: "danger";
  // "sheet" for a step in a flow (choosing, editing) rather than a confirmation; "side" for
  // the details of something on the page, beside it; "drawer" for a guide to the page, from the
  // bottom on a phone; "overlay" for a record's details over it.
  placement?: keyof typeof PLACEMENTS;
  // A sheet whose list runs long: its header stays at the top and the action bar at the foot
  // while only the body scrolls. Opt-in, as a scrolling body clips a field's popover (the date
  // picker), so a sheet holding fields keeps scrolling as a whole (its action bar still sticks).
  pinned?: boolean;
  // A form holding changes that closing would lose: closing then asks "Discard changes?" first.
  // useChanged() gives it from the form's values. Closing it yourself (open={false}, after a
  // save) never asks.
  dirty?: boolean;
  "data-testid"?: string;
};

// Whether a form's values differ from those it opened with, for Dialog's `dirty`. The values
// are compared as JSON, so pass a small object of what the person can change.
export function useChanged(values: unknown) {
  const [first] = useState(() => JSON.stringify(values));
  return JSON.stringify(values) !== first;
}

// The action bar's classes, for a sheet whose buttons live in its own <form> (DialogFooter).
export const ACTION_BAR =
  "sticky bottom-0 z-10 -mx-5 -mb-5 mt-auto flex items-center gap-3 border-t border-line bg-surface px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]";

// The action bar inside a sheet's own form: the summary on the left and the buttons on the
// right; with no summary on a phone the buttons share the width.
export function DialogFooter({ summary, children }: { summary?: ReactNode; children: ReactNode }) {
  return (
    <div className={ACTION_BAR}>
      <ActionBarContent summary={summary}>{children}</ActionBarContent>
    </div>
  );
}

function ActionBarContent({ summary, children }: { summary?: ReactNode; children: ReactNode }) {
  return (
    <>
      {summary && <div className="min-w-0 flex-1">{summary}</div>}
      <div
        className={cn(
          "flex flex-wrap items-center gap-3",
          summary ? "shrink-0 justify-end" : "flex-1 *:flex-1 sm:justify-end sm:*:flex-none",
        )}
      >
        {children}
      </div>
    </>
  );
}

// A total or count for the action bar: the figure, then a quiet line under it.
export function DialogSummary({ value, detail, "data-testid": testId }: { value: ReactNode; detail?: ReactNode; "data-testid"?: string }) {
  return (
    <div className="flex min-w-0 flex-col" data-testid={testId}>
      <span className="truncate font-display text-lg leading-tight font-extrabold tracking-tight tabular-nums">{value}</span>
      {detail && <span className="truncate text-xs text-muted">{detail}</span>}
    </div>
  );
}

// The close control on every dialog: a disc, so it isn't read as a field's clear button, with
// a 44px tap target. First to take focus, so a sheet doesn't open on a field and bring the
// keyboard up over it.
function CloseDisc({ onClose, floating = false }: { onClose: () => void; floating?: boolean }) {
  return (
    <button
      type="button"
      aria-label="Close"
      onClick={onClose}
      className={cn(
        "tap-target flex size-9 shrink-0 items-center justify-center rounded-full text-navy transition-colors duration-150 ease-calm",
        floating ? "absolute top-7 right-7 z-10 size-10 bg-surface/95 shadow-soft hover:bg-surface" : "bg-tag hover:bg-line",
      )}
    >
      <CloseGlyph className="size-4.5" />
    </button>
  );
}

// A modal over the page: the native <dialog>, so focus stays inside it. Every way of closing
// goes through requestClose (see Closing, above).
export function Dialog({
  open,
  onClose,
  title,
  meta,
  thumb,
  children,
  media,
  actions,
  summary,
  tone,
  placement = "center",
  pinned = false,
  dirty = false,
  "data-testid": testId,
}: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const drag = useRef<{ y: number; dy: number } | null>(null);
  const [asking, setAsking] = useState(false);
  // Whether the press being followed began outside the dialog, on its backdrop.
  const pressedOutside = useRef(false);

  const requestClose = () => (dirty ? setAsking(true) : onClose());

  // The backdrop is the <dialog> itself: a point on it but outside its box is outside. A nested
  // dialog's events bubble here through React, so only this dialog's own count.
  const outside = (event: ReactMouseEvent<HTMLDialogElement>) => {
    const dialog = event.currentTarget;
    if (event.target !== dialog) return false;
    const box = dialog.getBoundingClientRect();
    return event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom;
  };

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Drag the handle (or the header) down to close, as a phone's sheets do. Only below sm, where
  // the dialog is docked; a short drag springs back.
  const docked = DOCKED.has(placement);
  const onDragStart = (event: ReactPointerEvent<HTMLElement>) => {
    if (!docked || window.matchMedia("(min-width: 40rem)").matches) return;
    if ((event.target as HTMLElement).closest("button, a, input, textarea, select")) return;
    drag.current = { y: event.clientY, dy: 0 };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onDragMove = (event: ReactPointerEvent<HTMLElement>) => {
    const dialog = ref.current;
    if (!drag.current || !dialog) return;
    drag.current.dy = Math.max(0, event.clientY - drag.current.y);
    dialog.style.transition = "none";
    dialog.style.transform = `translateY(${drag.current.dy}px)`;
  };
  const onDragEnd = () => {
    const dialog = ref.current;
    const dy = drag.current?.dy ?? 0;
    drag.current = null;
    if (!dialog) return;
    dialog.style.transition = "transform 300ms var(--ease-calm)";
    dialog.style.transform = "";
    if (dy > DRAG_CLOSE) requestClose();
  };
  const dragHandlers = { onPointerDown: onDragStart, onPointerMove: onDragMove, onPointerUp: onDragEnd, onPointerCancel: onDragEnd };

  const handle = docked && (
    <div aria-hidden className="flex justify-center pt-2.5 pb-1 sm:hidden">
      <span className="h-1.5 w-10 rounded-full bg-line-strong/30" />
    </div>
  );

  const header = (
    <div className="flex items-start gap-3.5">
      {thumb && <div className="relative size-16 shrink-0 overflow-hidden rounded-[1.125rem] bg-mist">{thumb}</div>}
      <div className="flex min-w-0 flex-1 flex-col gap-1 pt-1">
        {tone === "danger" && (
          <span className="mb-2 flex size-11 items-center justify-center rounded-2xl bg-danger/10 text-danger">
            <AlertGlyph className="size-5.5" />
          </span>
        )}
        <h2 id={titleId} className="font-display text-xl leading-snug font-extrabold tracking-tight text-balance break-words">
          {title}
        </h2>
        {meta && <div className="text-sm text-pretty text-muted">{meta}</div>}
      </div>
      <CloseDisc onClose={requestClose} />
    </div>
  );

  const actionBar = actions && (
    <div className="sticky bottom-0 z-10 flex items-center gap-3 border-t border-line bg-surface px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      {placement === "side" ? (
        // A side panel's foot is its own: a price and its button, spaced apart.
        <div className="flex flex-1 flex-wrap items-center justify-between gap-3">{actions}</div>
      ) : (
        <ActionBarContent summary={summary}>{actions}</ActionBarContent>
      )}
    </div>
  );

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      data-testid={testId}
      data-placement={placement}
      // React bubbles a nested dialog's close (the rooms sheet inside the add sheet) up to this
      // one; only its own close closes it.
      onClose={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      // Escape: with changes, ask instead of closing.
      onCancel={(event) => {
        if (event.target !== event.currentTarget || !dirty) return;
        event.preventDefault();
        setAsking(true);
      }}
      onPointerDown={(event) => {
        pressedOutside.current = outside(event);
      }}
      onClick={(event) => {
        const both = pressedOutside.current && outside(event);
        pressedOutside.current = false;
        if (both) requestClose();
      }}
      className={cn(
        "card-edge bg-surface text-foreground shadow-float backdrop:bg-navy/50 backdrop:backdrop-blur-sm",
        placement === "side" ? "open:animate-panel-in" : placement === "drawer" ? "open:animate-sheet-in sm:open:animate-panel-in" : "open:animate-sheet-in",
        PLACEMENTS[placement],
      )}
    >
      {placement === "side" ? (
        <div className="relative flex h-full flex-col">
          <CloseDisc onClose={requestClose} floating />
          {/* Nothing in the body shrinks to fit; it scrolls. A `contents` wrapper's children are
              flex items too, so they're held as well (a clipped card would otherwise be squashed). */}
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain p-5 *:shrink-0 [&>.contents>*]:shrink-0">
            {media}
            <div className={cn("flex flex-col gap-1", !media && "pt-2 pr-14")}>
              <h2 id={titleId} className="font-display text-2xl leading-tight font-extrabold tracking-tight text-balance break-words">
                {title}
              </h2>
              {meta && <div className="text-sm text-pretty text-muted">{meta}</div>}
            </div>
            {children}
          </div>
          {actionBar}
        </div>
      ) : placement === "drawer" || placement === "overlay" || pinned ? (
        <div className={cn("flex flex-col", placement === "overlay" ? "max-h-[calc(100dvh-3rem)]" : "max-h-[inherit] sm:h-full")}>
          <div className="touch-none px-5 pb-3 sm:touch-auto" {...dragHandlers}>
            {handle}
            <div className={cn(!handle && "pt-5", handle && "sm:pt-5")}>{header}</div>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-5 pt-1 pb-[max(1.25rem,env(safe-area-inset-bottom))] *:shrink-0">
            {children}
          </div>
          {actionBar}
        </div>
      ) : (
        // A sheet holding fields scrolls as a whole (a scrolling body would clip the date
        // picker), with the action bar stuck to its foot.
        <div className="flex min-h-full flex-col">
          <div className="flex flex-col gap-4 px-5 pb-5">
            <div className="touch-none sm:touch-auto" {...dragHandlers}>
              {handle}
              <div className="pt-2 sm:pt-5">{header}</div>
            </div>
            {children}
          </div>
          {actionBar}
        </div>
      )}
      {asking && (
        <Dialog
          open
          onClose={() => setAsking(false)}
          title="Discard changes?"
          meta="What you changed here won't be saved."
          tone="danger"
          data-testid="discard-changes"
          actions={
            <>
              <Button type="button" variant="soft" onClick={() => setAsking(false)} data-testid="discard-keep">
                Keep editing
              </Button>
              <Button
                type="button"
                variant="danger"
                data-testid="discard-confirm"
                onClick={() => {
                  setAsking(false);
                  onClose();
                }}
              >
                Discard
              </Button>
            </>
          }
        />
      )}
    </dialog>
  );
}
