"use client";

import { useState, type FormEvent } from "react";
import { cn } from "./cn";

type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

// The browser's own checks (required, min, maxLength, type) shown our way: instead of its
// bubble, the message sits under the field in red. The browser fires `invalid` on each failing
// control when a form is submitted or its validity reported; we cancel the bubble, keep the
// message and move focus to the first failing control. Once shown, the message follows the
// value and goes as soon as it is valid. A field's own `error` (from the API) wins over it.
export function useFieldError(label: string) {
  const [message, setMessage] = useState<string>();

  return {
    message,
    onInvalid(event: FormEvent<Control>) {
      event.preventDefault();
      const control = event.currentTarget;
      setMessage(messageFor(control, label));
      const first = control.form?.querySelector<Control>("input:invalid, select:invalid, textarea:invalid");
      if (first === control) control.focus();
    },
    // Call from the control's change handler.
    recheck(control: Control) {
      if (message !== undefined) setMessage(control.validity.valid ? undefined : messageFor(control, label));
    },
  };
}

function messageFor(control: Control, label: string) {
  if (!control.validity.valueMissing) return control.validationMessage;
  if (control instanceof HTMLInputElement && control.type === "radio") return "Choose one.";
  if (control instanceof HTMLSelectElement) return `Choose ${label.toLowerCase()}.`;
  return `${label} is required.`;
}

// The line under a field: its error, with an icon so it isn't told by colour alone, or its hint.
export function FieldNote({
  id,
  error,
  hint,
  inset = false,
}: {
  id: string;
  error?: string;
  hint?: string;
  inset?: boolean;
}) {
  if (!error && !hint) return null;
  return (
    <span
      id={id}
      className={cn("flex items-start gap-1.5 text-xs font-normal", inset && "px-1", error ? "font-medium text-danger" : "text-muted")}
    >
      {error && (
        <svg aria-hidden viewBox="0 0 20 20" fill="currentColor" className="mt-px size-3.5 shrink-0">
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
            clipRule="evenodd"
          />
        </svg>
      )}
      {error ?? hint}
    </span>
  );
}
