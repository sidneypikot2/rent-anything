"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  children?: ReactNode;
  // The buttons along the bottom, the confirming one last.
  actions: ReactNode;
  "data-testid"?: string;
};

// A modal over the page, for confirming a step: the native <dialog>, so focus stays inside
// it and Escape closes it. A click on the backdrop closes it too.
export function Dialog({ open, onClose, title, children, actions, "data-testid": testId }: Props) {
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
      className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl border-[1.5px] border-line bg-surface text-foreground backdrop:bg-navy/60"
    >
      <div className="flex flex-col gap-4 p-5">
        <h2 id={titleId} className="font-display text-2xl font-bold italic">
          {title}
        </h2>
        {children}
        <div className="flex flex-wrap justify-end gap-3">{actions}</div>
      </div>
    </dialog>
  );
}
