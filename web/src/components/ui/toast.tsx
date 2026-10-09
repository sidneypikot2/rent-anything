"use client";

import { useEffect, useState, type ReactNode } from "react";

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
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-4">
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
      className="pointer-events-auto flex w-full max-w-lg flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl bg-navy px-4 py-3 text-sm text-white shadow-lg"
    >
      <div className="min-w-0 flex-1">{children}</div>
      <div className="flex items-center gap-3 font-semibold text-aqua">
        {actions}
        <button type="button" onClick={onDismiss} aria-label="Dismiss" className="text-on-dark hover:text-white">
          ✕
        </button>
      </div>
    </div>
  );
}
