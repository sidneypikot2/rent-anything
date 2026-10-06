"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { NAME_MAX, nameError } from "@/lib/person-name";

// A legal-name field's value and its check (lib/person-name): the error shows when the
// field is left or the form is sent, and clears while typing. Spread `props` on a Field.
export function useNameField(label: string, saved: string | null) {
  const [value, setValue] = useState(saved ?? "");
  const [error, setError] = useState<string>();
  const ref = useRef<HTMLInputElement>(null);

  return {
    value: value.trim(),
    props: {
      ref,
      value,
      error,
      maxLength: NAME_MAX,
      onChange: (event: ChangeEvent<HTMLInputElement>) => {
        setValue(event.target.value);
        setError(undefined);
      },
      onBlur: () => setError(value.trim() ? nameError(label, value) : undefined),
    },
    // On send: shows the error and returns false when the name doesn't pass.
    validate() {
      const message = nameError(label, value);
      setError(message);
      return !message;
    },
    focus: () => ref.current?.focus(),
  };
}
