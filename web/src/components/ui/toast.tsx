"use client";

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertGlyph } from "@/components/discovery/tag-glyphs";
import { cn } from "./cn";

// How many toasts are showing; while any is, the root carries data-toast.
let showing = 0;

// "danger" is a failure: red, so it can't be mistaken for a done step.
export type ToastTone = "default" | "danger";

type Props = {
  // The message; null hides the toast.
  message: ReactNode | null;
  // Changes with every new message, so the same text shown twice still restarts the timer.
  id?: number;
  onDismiss: () => void;
  // Small text buttons after the message ("Rename", "Change dates").
  actions?: ReactNode;
  tone?: ToastTone;
  // How long it stays, in milliseconds, while the pointer or focus isn't on it.
  duration?: number;
  "data-testid"?: string;
};

// A short note at the bottom of the screen that something happened. It disappears on its
// own and nothing waits for it; hovering or focusing it keeps it open. The live region
// stays mounted so screen readers announce each new message.
export function Toast({ message, id, ...props }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const shown = message !== null;

  // A Dialog is a modal <dialog>, in the browser's top layer, above any z-index, so the toast
  // is a popover in that layer too (RAA-161), always open (an empty one lets every click
  // through). The top layer stacks by opening order, so each new message, and each dialog
  // opened while one shows, puts it back on top.
  useLayoutEffect(() => {
    const region = ref.current;
    if (!region) return;
    raise(region);
    if (!shown) return;
    const observer = new MutationObserver((changes) => {
      if (changes.some((change) => change.target instanceof HTMLDialogElement && change.target.open)) raise(region);
    });
    observer.observe(document.body, { attributeFilter: ["open"], subtree: true });
    return () => observer.disconnect();
  }, [shown, id]);

  return (
    // From sm, above an area page's floating dock while it shows (--dock-space, floating-dock.ts);
    // on a phone it takes the dock's place instead (data-toast, globals.css), so the foot of the
    // screen holds one bar, not two over the card just tapped. The popover's own margin, border,
    // size and background are undone.
    <div
      ref={ref}
      popover="manual"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-auto bottom-0 m-0 flex h-auto w-full max-w-none justify-center overflow-visible border-0 bg-transparent p-0 px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-[calc(1rem+var(--dock-space,0px))]"
    >
      {shown && (
        <ToastCard key={id ?? String(message)} {...props}>
          {message}
        </ToastCard>
      )}
    </div>
  );
}

// Re-opening a popover moves it to the top of the top layer.
function raise(region: HTMLElement) {
  if (region.matches(":popover-open")) region.hidePopover();
  region.showPopover();
}

// One message: its own timer and hover state, both gone when it unmounts.
function ToastCard({
  children,
  onDismiss,
  actions,
  tone = "default",
  duration = 6000,
  "data-testid": testId,
}: Omit<Props, "message" | "id"> & { children: ReactNode }) {
  const [held, setHeld] = useState(false);
  const danger = tone === "danger";

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
      data-tone={tone}
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={() => setHeld(false)}
      className={cn(
        "pointer-events-auto flex w-full max-w-lg animate-rise flex-wrap items-center gap-x-4 gap-y-2 focus-light rounded-card border px-4 py-3 text-sm text-white shadow-lift backdrop-blur-lg",
        danger ? "border-danger bg-danger" : "border-glass-edge bg-navy/90",
      )}
    >
      {/* A phone gives the message its own line, so a trip's name isn't squeezed by the actions. */}
      <div className="flex min-w-0 flex-1 items-start gap-2 max-sm:basis-full">
        {danger && <AlertGlyph className="size-5 shrink-0" />}
        <div className="min-w-0 flex-1">{children}</div>
      </div>
      <div className={cn("flex items-center gap-3 font-semibold", danger ? "text-white" : "text-aqua")}>
        {actions}
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className={danger ? "text-white/80 hover:text-white" : "text-on-dark hover:text-white"}
        >
          ✕
        </button>
      </div>
    </div>
  );
}

type ShowOptions = { tone?: ToastTone; actions?: ReactNode; "data-testid"?: string };
type Notice = ShowOptions & { id: number; message: ReactNode };
type ToastContext = { show: (message: ReactNode, options?: ShowOptions) => void; dismiss: () => void };

const ToastContext = createContext<ToastContext | null>(null);

// The app's one toast (RAA-161): anything can show a note through useToast(), and a new one
// replaces the last, so two never stack at the foot of the screen.
export function ToastProvider({ children }: { children: ReactNode }) {
  const [notice, setNotice] = useState<Notice | null>(null);
  const show = useCallback(
    (message: ReactNode, options?: ShowOptions) => setNotice({ ...options, message, id: Date.now() }),
    [],
  );
  const dismiss = useCallback(() => setNotice(null), []);
  const value = useMemo(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toast
        message={notice?.message ?? null}
        id={notice?.id}
        tone={notice?.tone}
        actions={notice?.actions}
        onDismiss={dismiss}
        data-testid={notice?.["data-testid"] ?? "toast"}
      />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast needs a ToastProvider");
  return context;
}

// A failed write's onError: its message as a red toast, beside the dialog's own inline one.
export function useErrorToast() {
  const { show } = useToast();
  return useCallback((error: Error) => show(error.message, { tone: "danger", "data-testid": "error-toast" }), [show]);
}
