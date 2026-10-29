import { useId } from "react";
import type { CountryCode } from "libphonenumber-js";
import { COUNTRIES, countryFlag } from "@/lib/countries";
import { cn } from "./cn";
import { FieldNote, useFieldError } from "./field-error";

type Props = {
  label: string;
  number: string;
  onNumberChange: (number: string) => void;
  required?: boolean;
  hint?: string;
  error?: string;
  // With these, the code in front is a picker (guests from anywhere); without, a fixed +63.
  country?: CountryCode;
  onCountryChange?: (country: CountryCode) => void;
};

// A phone number: the country code in front of the number, drawn as one field. The caller
// checks it (libphonenumber-js) and sends one international number.
export function PhoneField({
  label,
  number,
  onNumberChange,
  required,
  hint,
  error: apiError,
  country = "PH",
  onCountryChange,
}: Props) {
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
        {onCountryChange ? (
          // The native picker sits invisibly over the code it shows, so a phone opens its own
          // list; the field's focus ring shows it's focused.
          <span className="relative flex items-center gap-1 border-r-[1.5px] border-line-strong bg-surface-2 px-3 font-normal text-foreground">
            <span aria-hidden>
              {countryFlag(country)} +{COUNTRIES.find((item) => item.code === country)?.dial}
            </span>
            <svg aria-hidden viewBox="0 0 20 20" fill="currentColor" className="size-4 text-muted">
              <path d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z" />
            </svg>
            <select
              aria-label="Country code"
              data-testid="phone-country"
              value={country}
              onChange={(event) => onCountryChange(event.target.value as CountryCode)}
              className="absolute inset-0 cursor-pointer opacity-0"
            >
              {COUNTRIES.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.name} +{item.dial}
                </option>
              ))}
            </select>
          </span>
        ) : (
          <span aria-hidden className="flex items-center border-r-[1.5px] border-line-strong bg-surface-2 px-3 font-normal text-muted">
            🇵🇭 +63
          </span>
        )}
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
