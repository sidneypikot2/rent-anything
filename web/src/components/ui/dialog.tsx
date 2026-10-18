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
  // the details of something on the page, beside it.
  placement?: keyof typeof PLACEMENTS;
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
        placement === "side" ? "open:animate-panel-in" : "open:animate-rise",
        PLACEMENTS[placement],
      )}
    >
      {placement === "side" ? (
        <div className="relative flex h-full flex-col">
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="absolute top-7 right-7 z-10 flex size-11 items-center justify-center rounded-full bg-surface/90 text-foreground shadow-soft backdrop-blur-sm transition-colors duration-300 ease-calm hover:bg-surface"
          >
            <CloseGlyph className="size-5" />
          </button>
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain p-5 *:shrink-0">
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
      ) : (
        <div className="flex flex-col gap-4 p-5">
          {/* A way out that doesn't need Escape or a tap beside it, which a sheet filling a
              phone leaves no room for. First to take focus, so a sheet doesn't open on a field
              and bring the keyboard up over it. On a disc, as the side panel's, so it isn't
              read as a field's own clear button under it. */}
          <div className="flex items-start justify-between gap-3">
            <h2 id={titleId} className="pt-1.5 font-display text-2xl font-extrabold tracking-tight">
              {title}
            </h2>
            <Button type="button" variant="quiet" size="icon" aria-label="Close" onClick={onClose} className="-mt-1 -mr-2 shrink-0 bg-surface-2">
              <CloseGlyph className="size-5" />
            </Button>
          </div>
          {children}
          {actions && <div className="flex flex-wrap justify-end gap-3">{actions}</div>}
        </div>
      )}
    </dialog>
  );
}
