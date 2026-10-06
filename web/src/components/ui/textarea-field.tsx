import { useId, type ComponentProps } from "react";
import { cn } from "./cn";

type Props = {
  label: string;
  hint?: string;
  error?: string;
} & ComponentProps<"textarea">;

// A labelled multi-line input, styled like Field, with an optional hint or an error in its place.
export function TextareaField({ label, hint, error, className, rows = 4, ...props }: Props) {
  const noteId = useId();
  const note = error ?? hint;

  return (
    <label className="flex flex-col gap-1 text-sm font-medium">
      {label}
      <textarea
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={note ? noteId : undefined}
        className={cn(
          "rounded-lg border-[1.5px] bg-surface px-3 py-2 font-normal text-foreground outline-none",
          "placeholder:text-muted/80 focus:border-primary disabled:bg-surface-2",
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
