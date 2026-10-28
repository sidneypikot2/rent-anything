import type { ReactNode } from "react";
import { ChevronGlyph } from "@/components/discovery/tag-glyphs";
import { cn } from "./cn";

// A dialog's choices as one grouped card of rows (the modal redesign, 2026-10-28): the trip,
// its dates, its guests, each a row with an icon, a label and its value, changed on the row (a
// stepper) or by opening it (a picker). It reads as a summary of what is being booked rather
// than a form. Notes about the rows go in its foot (TicketNote).
export function Ticket({ children, className, "data-testid": testId }: { children: ReactNode; className?: string; "data-testid"?: string }) {
  return (
    <div
      data-testid={testId}
      className={cn("overflow-hidden rounded-[1.375rem] border border-line bg-surface [&>*+*]:border-t [&>*+*]:border-line", className)}
    >
      {children}
    </div>
  );
}

type RowProps = {
  // A line icon (tag-glyphs), shown in a tinted well; or `media` for a picture in its place.
  icon?: ReactNode;
  media?: ReactNode;
  label?: ReactNode;
  value: ReactNode;
  // Quieter words after the value, on its line ("· up to 12").
  detail?: ReactNode;
  // What changes it in place (a stepper), at the row's end.
  control?: ReactNode;
  // Opens a picker: the whole row is the button, with a chevron.
  onClick?: () => void;
  // A choice in a picker: the row is a radio, ringed while picked.
  selected?: boolean;
  disabled?: boolean;
  className?: string;
  "data-testid"?: string;
};

// One row of a Ticket. 64px high at least, so it is a comfortable target as a whole.
export function TicketRow({ icon, media, label, value, detail, control, onClick, selected, disabled, className, "data-testid": testId }: RowProps) {
  const picking = selected !== undefined;
  const body = (
    <>
      {media ?? (icon && (
        <span
          className={cn(
            "flex size-9.5 shrink-0 items-center justify-center rounded-xl text-action-ink",
            selected ? "bg-surface" : "bg-action-tint",
            "[&>svg]:size-5",
          )}
        >
          {icon}
        </span>
      ))}
      <span className="flex min-w-0 flex-1 flex-col">
        {label && <span className="text-xs font-semibold text-muted">{label}</span>}
        <span className="text-control font-bold text-pretty break-words">
          {value}
          {detail && <span className="font-medium text-muted"> · {detail}</span>}
        </span>
      </span>
      {control}
      {onClick && !picking && <ChevronGlyph className="size-4.5 shrink-0 -rotate-90 text-muted" />}
      {picking && (
        <span
          aria-hidden
          className={cn(
            "flex size-5 shrink-0 items-center justify-center rounded-full",
            selected ? "bg-action-ink text-white" : "border-[1.5px] border-line-strong",
          )}
        >
          {selected && <span className="size-2 rounded-full bg-white" />}
        </span>
      )}
    </>
  );
  const rowClass = cn(
    "flex min-h-16 w-full items-center gap-3 px-3.5 py-3 text-left first:rounded-t-[1.3125rem] last:rounded-b-[1.3125rem]",
    selected && "bg-action-tint inset-ring-2 inset-ring-action-ink",
    className,
  );
  if (onClick)
    return (
      <button
        type="button"
        role={picking ? "radio" : undefined}
        aria-checked={picking ? selected : undefined}
        onClick={onClick}
        disabled={disabled}
        data-testid={testId}
        className={cn(rowClass, "transition-colors duration-300 ease-calm hover:bg-surface-2 disabled:opacity-50", selected && "hover:bg-action-tint")}
      >
        {body}
      </button>
    );
  return (
    <div data-testid={testId} className={rowClass}>
      {body}
    </div>
  );
}

// A note about the ticket's rows, in its foot: `info` on mist, `warning` for a problem, `ok` for
// good news (a full refund).
export function TicketNote({ tone = "info", children, "data-testid": testId }: { tone?: "info" | "warning" | "ok"; children: ReactNode; "data-testid"?: string }) {
  return (
    <div
      role="status"
      data-testid={testId}
      className={cn(
        "flex items-start gap-2.5 px-3.5 py-3 text-sm text-pretty",
        tone === "info" && "bg-mist text-foreground",
        tone === "warning" && "bg-warning/10 text-foreground",
        tone === "ok" && "bg-sage text-emerald",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "mt-1.5 size-2 shrink-0 rounded-full",
          tone === "info" && "bg-action",
          tone === "warning" && "bg-warning",
          tone === "ok" && "bg-emerald",
        )}
      />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
