import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn";

// The buttons over a map's corners, shared by the area map and the plan's results map: a white
// pill (a toggle when `pressed` is given) and one button of the zoom stack.
export function MapButton({
  pressed,
  onClick,
  children,
  "data-testid": testId,
}: {
  // Left out for a plain action, which isn't a toggle.
  pressed?: boolean;
  onClick: () => void;
  children: ReactNode;
  "data-testid"?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      data-testid={testId}
      className={cn(
        "flex min-h-11 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold card-edge shadow-lift transition-colors duration-300 ease-calm",
        pressed ? "bg-primary text-white" : "bg-surface text-foreground [&_svg]:text-primary",
      )}
    >
      {children}
    </button>
  );
}

export function ZoomButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex size-11 items-center justify-center border-line not-first:border-t hover:bg-surface-2"
    >
      {children}
    </button>
  );
}
