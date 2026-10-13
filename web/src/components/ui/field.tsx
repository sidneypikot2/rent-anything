import { useId, type ComponentProps } from "react";
import { cn } from "./cn";

type Props = {
  label: string;
  hint?: string;
  error?: string;
} & ComponentProps<"input">;

// A labelled text input with an optional hint, or an error in its place.
export function Field({ label, hint, error, className, ...props }: Props) {
  const noteId = useId();
  const note = error ?? hint;

  return (
    <label className="flex flex-col gap-1.5 text-sm font-semibold">
      {label}
      <input
        aria-invalid={error ? true : undefined}
        aria-describedby={note ? noteId : undefined}
        className={cn(
          "min-h-12 rounded-xl border bg-surface px-4 py-2.5 font-normal text-foreground outline-none",
          "placeholder:text-muted/80 focus:border-primary focus:ring-4 focus:ring-sky-mist disabled:bg-surface-2",
          error ? "border-danger" : "border-line-strong",
          className,
        )}
        {...props}
      />
      {note && (
        <span id={noteId} className={cn("text-xs font-normal", error ? "text-danger" : "text-muted")}>
          {note}
        </span>
      )}
    </label>
  );
}
