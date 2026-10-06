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
      {/* Our own chevron in the right padding: the browser's arrow sits wherever it likes
          and can run into the border. */}
      <div className="relative">
        <select
          id={selectId}
          aria-invalid={error ? true : undefined}
          aria-describedby={note ? noteId : undefined}
          className={cn(
            "w-full appearance-none rounded-lg border-[1.5px] bg-surface py-2 pl-3 pr-9 font-normal text-foreground outline-none",
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
        <svg
          aria-hidden
          viewBox="0 0 20 20"
          fill="currentColor"
          className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted"
        >
          <path d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z" />
        </svg>
      </div>
      {note && (
        <span id={noteId} className={cn("text-xs font-normal", error ? "text-danger" : "text-muted")}>
          {note}
        </span>
      )}
    </div>
  );
}
