"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { CloseGlyph } from "@/components/discovery/tag-glyphs";
import { Button } from "./button";
import { cn } from "./cn";

const PLACEMENTS = {
  center: "m-auto w-[calc(100%-2rem)] max-w-lg rounded-card",
  // Docked to the bottom on a phone, centred from sm: up.
  sheet:
    "mx-0 mb-0 mt-auto max-h-[90dvh] w-full max-w-none rounded-t-card sm:m-auto sm:w-[calc(100%-2rem)] sm:max-w-lg sm:rounded-card",
  // A floating panel on the right, 12px in from the window's edges (RAA-126): `media` leads,
  // the title under it with the details, `actions` pinned at the foot and what's between
  // scrolling; the close button floats at the top right.
  side: "my-3 mr-3 ml-auto h-[calc(100dvh-1.5rem)] max-h-[calc(100dvh-1.5rem)] w-[calc(100%-1.5rem)] max-w-md rounded-card",
  // A sheet from the bottom on a phone, in thumb's reach, and the side panel from sm: up, for a
  // guide to the page under it (the trip's plan). The title and close button stay at its top and
  // only the body scrolls, so nothing floats over the text.
  drawer:
    "mx-0 mb-0 mt-auto max-h-[88dvh] w-full max-w-none rounded-t-card sm:my-3 sm:mr-3 sm:ml-auto sm:h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-1.5rem)] sm:w-[calc(100%-1.5rem)] sm:max-w-md sm:rounded-card",
  // Centred and wider, for the whole of a record on a work screen: the title and close button
  // stay at the top and `actions` at the foot, and what's between scrolls.
  overlay: "m-auto max-h-[calc(100dvh-3rem)] w-[calc(100%-2rem)] max-w-2xl overflow-hidden rounded-card",
};

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  children?: ReactNode;
  // A side panel's photo, above its title.
  media?: ReactNode;
  // The buttons along the bottom, the confirming one last. A sheet whose buttons sit
  // inside its own form leaves them out.
  actions?: ReactNode;
  // "sheet" for a step in a flow (choosing, editing) rather than a confirmation; "side" for
  // the details of something on the page, beside it; "drawer" for a guide to the page, from the
  // bottom on a phone; "overlay" for a record's details over it.
  placement?: keyof typeof PLACEMENTS;
  // A sheet whose list runs long: its title and close button stay at the top and `actions` at
  // the foot while only the body scrolls. Opt-in, as a scrolling body clips a field's popover
  // (the date picker), so a sheet holding fields keeps scrolling as a whole.
  pinned?: boolean;
  "data-testid"?: string;
};

// A modal over the page, for confirming a step, or as a sheet for a step in a flow: the
// native <dialog>, so focus stays inside it and Escape closes it. A click on the backdrop
// closes it too, so a side panel gives the page back with one click beside it.
export function Dialog({
  open,
  onClose,
  title,
  children,
  media,
  actions,
  placement = "center",
  pinned = false,
  "data-testid": testId,
}: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // A way out that doesn't need Escape or a tap beside it, which a sheet filling a phone leaves
  // no room for. First to take focus, so a sheet doesn't open on a field and bring the keyboard
  // up over it. On a disc, as the side panel's, so it isn't read as a field's own clear button
  // under it.
  const header = (
    <div className="flex items-start justify-between gap-3">
      <h2 id={titleId} className="pt-1.5 font-display text-2xl font-extrabold tracking-tight break-words">
        {title}
      </h2>
      <Button type="button" variant="quiet" size="icon" aria-label="Close" onClick={onClose} className="-mt-1 -mr-2 shrink-0">
        <CloseGlyph className="size-5" />
      </Button>
    </div>
  );

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      data-testid={testId}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className={cn(
        "card-edge bg-surface text-foreground shadow-float backdrop:bg-navy/50 backdrop:backdrop-blur-sm",
        placement === "side" ? "open:animate-panel-in" : placement === "drawer" ? "open:animate-rise sm:open:animate-panel-in" : "open:animate-rise",
        PLACEMENTS[placement],
      )}
    >
      {placement === "side" ? (
        <div className="relative flex h-full flex-col">
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="absolute top-7 right-7 z-10 flex size-11 items-center justify-center rounded-button bg-surface text-navy inset-ring-1 inset-ring-line transition-colors duration-150 ease-calm hover:bg-surface-2"
          >
            <CloseGlyph className="size-5" />
          </button>
          {/* Nothing in the body shrinks to fit; it scrolls. A `contents` wrapper's children are
              flex items too, so they're held as well (a clipped card would otherwise be squashed). */}
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain p-5 *:shrink-0 [&>.contents>*]:shrink-0">
            {media}
            <h2
              id={titleId}
              className={cn(
                "font-display text-2xl leading-tight font-extrabold tracking-tight text-balance break-words",
                !media && "pt-2 pr-14",
              )}
            >
              {title}
            </h2>
            {children}
          </div>
          {actions && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3">{actions}</div>
          )}
        </div>
      ) : placement === "drawer" ? (
        <div className="flex max-h-[inherit] flex-col sm:h-full">
          <div className="border-b border-line px-5 pt-4 pb-3">{header}</div>
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] *:shrink-0">
            {children}
          </div>
        </div>
      ) : placement === "overlay" || (placement === "sheet" && pinned) ? (
        <div className={cn("flex flex-col", placement === "sheet" ? "max-h-[inherit]" : "max-h-[calc(100dvh-3rem)]")}>
          <div className="border-b border-line px-5 pt-5 pb-4">{header}</div>
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain p-5 *:shrink-0">{children}</div>
          {actions && (
            <div
              className={cn(
                "flex flex-wrap items-center gap-3 border-t border-line px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]",
                placement === "sheet" ? "justify-end" : "justify-between",
              )}
            >
              {actions}
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4 p-5">
          {header}
          {children}
          {actions && <div className="flex flex-wrap justify-end gap-3">{actions}</div>}
        </div>
      )}
    </dialog>
  );
}
