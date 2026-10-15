"use client";

import { useId, type ComponentProps } from "react";
import { cn } from "./cn";
import { FieldNote, useFieldError } from "./field-error";
import { controlClasses, floatingLabelClasses, useFieldLook } from "./field-look";

type Props = {
  label: string;
  options: { value: string; label: string }[];
  hint?: string;
  error?: string;
} & ComponentProps<"select">;

// A labelled select, styled like Field, with an optional hint or an error in its place. Under a
// floating FieldLook its label stays on the top border: a select always shows a value.
export function SelectField({ label, options, hint, error: apiError, className, onChange, ...props }: Props) {
  const look = useFieldLook();
  const selectId = useId();
  const noteId = useId();
  const native = useFieldError(label);
  const error = apiError ?? native.message;
  const note = error ?? hint;

  // The label points at the select rather than wrapping it: wrapped, a select's options
  // become part of its accessible name.
  return (
    <div className="flex flex-col gap-1.5 text-sm font-semibold">
      {look === "stacked" && <label htmlFor={selectId}>{label}</label>}
      {/* Our own chevron in the right padding: the browser's arrow sits wherever it likes
          and can run into the border. */}
      <div className="relative">
        <select
          id={selectId}
          aria-invalid={error ? true : undefined}
          aria-describedby={note ? noteId : undefined}
          className={cn("w-full appearance-none pr-10", controlClasses(look, error), className)}
          onInvalid={native.onInvalid}
          onChange={(event) => {
            native.recheck(event.currentTarget);
            onChange?.(event);
          }}
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
        {look === "floating" && (
          <label htmlFor={selectId} className={floatingLabelClasses({ error, raised: true })}>
            {label}
          </label>
        )}
      </div>
      <FieldNote id={noteId} error={error} hint={hint} inset={look === "floating"} />
    </div>
  );
}
