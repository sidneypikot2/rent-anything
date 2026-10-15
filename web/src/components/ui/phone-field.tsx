import { useId } from "react";
import { cn } from "./cn";
import { FieldNote, useFieldError } from "./field-error";

type Props = {
  label: string;
  number: string;
  onNumberChange: (number: string) => void;
  required?: boolean;
  hint?: string;
  error?: string;
};

// A Philippine phone number: a fixed +63 in front of the number, drawn as one field. The
// caller checks it (libphonenumber-js) and sends one international number.
export function PhoneField({ label, number, onNumberChange, required, hint, error: apiError }: Props) {
  const inputId = useId();
  const noteId = useId();
  const native = useFieldError(label);
  const error = apiError ?? native.message;
  const note = error ?? hint;

  return (
    <div className="flex flex-col gap-1.5 text-sm font-semibold">
      <label htmlFor={inputId}>{label}</label>
      <div
        className={cn(
          "flex min-h-12 overflow-hidden rounded-control border bg-surface transition-[border-color,box-shadow] duration-300 ease-calm focus-within:ring-4",
          error ? "border-danger focus-within:border-danger focus-within:ring-danger/10" : "border-line-strong focus-within:border-primary focus-within:ring-sky-mist",
        )}
      >
        <span aria-hidden className="flex items-center border-r-[1.5px] border-line-strong bg-surface-2 px-3 font-normal text-muted">
          🇵🇭 +63
        </span>
        <input
          id={inputId}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          required={required}
          value={number}
          onInvalid={native.onInvalid}
          onChange={(event) => {
            native.recheck(event.currentTarget);
            onNumberChange(event.target.value);
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={note ? noteId : undefined}
          className="min-w-0 flex-1 bg-transparent px-4 py-2.5 font-normal text-foreground outline-none transition-[border-color,box-shadow] duration-300 ease-calm placeholder:text-muted/80"
        />
      </div>
      <FieldNote id={noteId} error={error} hint={hint} />
    </div>
  );
}
