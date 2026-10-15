"use client";

import { useId, type ComponentProps } from "react";
import { cn } from "./cn";
import { FieldNote, useFieldError } from "./field-error";
import { controlClasses, floatingLabelClasses, useFieldLook } from "./field-look";

type Props = {
  label: string;
  hint?: string;
  error?: string;
} & ComponentProps<"input">;

// A labelled text input with an optional hint, or an error in its place. The label sits above
// the field, or inside it under <FieldLook look="floating">.
export function Field({ label, hint, error: apiError, className, placeholder, onChange, ...props }: Props) {
  const look = useFieldLook();
  const inputId = useId();
  const noteId = useId();
  const native = useFieldError(label);
  const error = apiError ?? native.message;
  const note = error ?? hint;
  const floating = look === "floating";

  const input = (
    <input
      id={inputId}
      aria-invalid={error ? true : undefined}
      aria-describedby={note ? noteId : undefined}
      // A floating label reads :placeholder-shown to know the field is empty, so it needs one.
      placeholder={floating ? (placeholder ?? " ") : placeholder}
      className={cn("w-full", controlClasses(look, error), className)}
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
          {input}
          <label htmlFor={inputId} className={floatingLabelClasses({ error })}>
            {label}
          </label>
        </div>
      ) : (
        <>
          <label htmlFor={inputId}>{label}</label>
          {input}
        </>
      )}
      <FieldNote id={noteId} error={error} hint={hint} inset={floating} />
    </div>
  );
}
