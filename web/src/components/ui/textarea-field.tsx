"use client";

import { useId, type ComponentProps } from "react";
import { cn } from "./cn";
import { FieldNote, useFieldError } from "./field-error";
import { controlClasses, floatingLabelClasses, useFieldLook } from "./field-look";

type Props = {
  label: string;
  hint?: string;
  error?: string;
} & ComponentProps<"textarea">;

// A labelled multi-line input, styled like Field, with an optional hint or an error in its place.
export function TextareaField({ label, hint, error: apiError, className, rows = 4, placeholder, onChange, ...props }: Props) {
  const look = useFieldLook();
  const textareaId = useId();
  const noteId = useId();
  const native = useFieldError(label);
  const error = apiError ?? native.message;
  const note = error ?? hint;
  const floating = look === "floating";

  const textarea = (
    <textarea
      id={textareaId}
      rows={rows}
      aria-invalid={error ? true : undefined}
      aria-describedby={note ? noteId : undefined}
      placeholder={floating ? (placeholder ?? " ") : placeholder}
      className={cn("w-full", controlClasses(look, error), floating ? "pt-4" : "py-3", className)}
      onInvalid={native.onInvalid}
      onChange={(event) => {
        native.recheck(event.currentTarget);
        onChange?.(event);
      }}
      {...props}
    />
  );

  return (
    <div className="flex flex-col gap-1.5 text-sm font-semibold">
      {floating ? (
        <div className="relative">
          {textarea}
          <label htmlFor={textareaId} className={floatingLabelClasses({ error, multiline: true })}>
            {label}
          </label>
        </div>
      ) : (
        <>
          <label htmlFor={textareaId}>{label}</label>
          {textarea}
        </>
      )}
      <FieldNote id={noteId} error={error} hint={hint} inset={floating} />
    </div>
  );
}
