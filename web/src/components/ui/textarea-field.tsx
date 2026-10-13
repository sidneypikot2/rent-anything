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
    <label className="flex flex-col gap-1.5 text-sm font-semibold">
      {label}
      <textarea
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={note ? noteId : undefined}
        className={cn(
          "rounded-control border bg-surface px-4 py-3 font-normal text-foreground outline-none transition-[border-color,box-shadow] duration-300 ease-calm",
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
