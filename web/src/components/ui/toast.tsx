"use client";

import { useEffect, useState, type ReactNode } from "react";

// How many toasts are showing; while any is, the root carries data-toast.
let showing = 0;

type Props = {
  // The message; null hides the toast.
  message: ReactNode | null;
  // Changes with every new message, so the same text shown twice still restarts the timer.
  id?: number;
  onDismiss: () => void;
  // Small text buttons after the message ("Rename", "Change dates").
  actions?: ReactNode;
  // How long it stays, in milliseconds, while the pointer or focus isn't on it.
  duration?: number;
  "data-testid"?: string;
};

// A short note at the bottom of the screen that something happened. It disappears on its
// own and nothing waits for it; hovering or focusing it keeps it open. The live region
// stays mounted so screen readers announce each new message.
export function Toast({ message, id, ...props }: Props) {
  return (
    // From sm, above an area page's floating dock while it shows (--dock-space, floating-dock.ts);
    // on a phone it takes the dock's place instead (data-toast, globals.css), so the foot of the
    // screen holds one bar, not two over the card just tapped.
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[61] flex justify-center px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:z-50 sm:pb-[calc(1rem+var(--dock-space,0px))]"
    >
      {message !== null && (
        <ToastCard key={id ?? String(message)} {...props}>
          {message}
        </ToastCard>
      )}
    </div>
  );
}

// One message: its own timer and hover state, both gone when it unmounts.
function ToastCard({
  children,
  onDismiss,
  actions,
  duration = 6000,
  "data-testid": testId,
}: Omit<Props, "message" | "id"> & { children: ReactNode }) {
  const [held, setHeld] = useState(false);

  useEffect(() => {
    showing += 1;
    document.documentElement.dataset.toast = "";
    return () => {
      showing -= 1;
      if (showing === 0) delete document.documentElement.dataset.toast;
    };
  }, []);

  useEffect(() => {
    if (held) return;
    const timer = window.setTimeout(onDismiss, duration);
    return () => window.clearTimeout(timer);
  }, [held, duration, onDismiss]);

  return (
    <div
      data-testid={testId}
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={() => setHeld(false)}
      className="pointer-events-auto flex w-full max-w-lg animate-rise flex-wrap items-center gap-x-4 gap-y-2 focus-light rounded-card border border-glass-edge bg-navy/90 px-4 py-3 text-sm text-white shadow-lift backdrop-blur-lg"
    >
      {/* A phone gives the message its own line, so a trip's name isn't squeezed by the actions. */}
      <div className="min-w-0 flex-1 max-sm:basis-full">{children}</div>
      <div className="flex items-center gap-3 font-semibold text-aqua">
        {actions}
        <button type="button" onClick={onDismiss} aria-label="Dismiss" className="text-on-dark hover:text-white">
          ✕
        </button>
      </div>
    </div>
  );
}
