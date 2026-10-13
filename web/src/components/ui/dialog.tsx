"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { cn } from "./cn";

const PLACEMENTS = {
  center: "m-auto w-[calc(100%-2rem)] max-w-lg rounded-card",
  // Docked to the bottom on a phone, centred from sm: up.
  sheet:
    "mx-0 mb-0 mt-auto max-h-[90dvh] w-full max-w-none rounded-t-card sm:m-auto sm:w-[calc(100%-2rem)] sm:max-w-lg sm:rounded-card",
};

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  children?: ReactNode;
  // The buttons along the bottom, the confirming one last. A sheet whose buttons sit
  // inside its own form leaves them out.
  actions?: ReactNode;
  // "sheet" for a step in a flow (choosing, editing) rather than a confirmation.
  placement?: keyof typeof PLACEMENTS;
  "data-testid"?: string;
};

// A modal over the page, for confirming a step, or as a sheet for a step in a flow: the
// native <dialog>, so focus stays inside it and Escape closes it. A click on the backdrop
// closes it too.
export function Dialog({
  open,
  onClose,
  title,
  children,
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
      className={cn("card-edge bg-surface text-foreground shadow-float open:animate-rise backdrop:bg-navy/50 backdrop:backdrop-blur-sm", PLACEMENTS[placement])}
    >
      <div className="flex flex-col gap-4 p-5">
        <h2 id={titleId} className="font-display text-2xl font-extrabold tracking-tight">
          {title}
        </h2>
        {children}
        {actions && <div className="flex flex-wrap justify-end gap-3">{actions}</div>}
      </div>
    </dialog>
  );
}
