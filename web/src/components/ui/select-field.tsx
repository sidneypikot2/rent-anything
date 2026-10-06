import { useId, type ComponentProps } from "react";
import { cn } from "./cn";

type Props = {
  label: string;
  options: { value: string; label: string }[];
  hint?: string;
  error?: string;
} & ComponentProps<"select">;

// A labelled select, styled like Field, with an optional hint or an error in its place.
export function SelectField({ label, options, hint, error, className, ...props }: Props) {
  const selectId = useId();
  const noteId = useId();
  const note = error ?? hint;

  // The label points at the select rather than wrapping it: wrapped, a select's options
  // become part of its accessible name.
  return (
    <div className="flex flex-col gap-1 text-sm font-medium">
      <label htmlFor={selectId}>{label}</label>
      <select
        id={selectId}
        aria-invalid={error ? true : undefined}
        aria-describedby={note ? noteId : undefined}
        className={cn(
          "rounded-lg border-[1.5px] bg-surface px-3 py-2 font-normal text-foreground outline-none",
          "focus:border-primary disabled:bg-surface-2",
          error ? "border-danger" : "border-line-strong",
          className,
        )}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {note && (
        <span id={noteId} className={cn("text-xs font-normal", error ? "text-danger" : "text-muted")}>
          {note}
        </span>
      )}
    </div>
  );
}
