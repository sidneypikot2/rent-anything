import { useId } from "react";
import { cn } from "./cn";

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
export function PhoneField({ label, number, onNumberChange, required, hint, error }: Props) {
  const inputId = useId();
  const noteId = useId();
  const note = error ?? hint;

  return (
    <div className="flex flex-col gap-1 text-sm font-medium">
      <label htmlFor={inputId}>{label}</label>
      <div
        className={cn(
          "flex overflow-hidden rounded-lg border-[1.5px] bg-surface focus-within:border-primary",
          error ? "border-danger" : "border-line-strong",
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
          onChange={(event) => onNumberChange(event.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={note ? noteId : undefined}
          className="min-w-0 flex-1 bg-transparent px-3 py-2 font-normal text-foreground outline-none placeholder:text-muted/80"
        />
      </div>
      {note && (
        <span id={noteId} className={cn("text-xs font-normal", error ? "text-danger" : "text-muted")}>
          {note}
        </span>
      )}
    </div>
  );
}
