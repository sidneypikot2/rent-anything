"use client";

import { getCountries, getCountryCallingCode, type CountryCode } from "libphonenumber-js";
import { useId } from "react";
import { cn } from "./cn";

const names = new Intl.DisplayNames(["en"], { type: "region" });

// "🇵🇭": a flag is the country code's two letters as regional indicator symbols.
function flag(country: string) {
  return String.fromCodePoint(...[...country].map((letter) => 0x1f1a5 + letter.charCodeAt(0)));
}

const DIAL_CODES = getCountries()
  .map((country) => ({
    country,
    name: names.of(country) ?? country,
    code: getCountryCallingCode(country),
  }))
  .sort((a, b) => (a.country === "PH" ? -1 : b.country === "PH" ? 1 : a.name.localeCompare(b.name)));

type Props = {
  label: string;
  country: CountryCode;
  number: string;
  onCountryChange: (country: CountryCode) => void;
  onNumberChange: (number: string) => void;
  required?: boolean;
  hint?: string;
  error?: string;
};

// A phone number as a dial code and the number after it. The caller joins and checks
// them (libphonenumber-js) and sends one international number.
export function PhoneField({ label, country, number, onCountryChange, onNumberChange, required, hint, error }: Props) {
  const inputId = useId();
  const noteId = useId();
  const note = error ?? hint;
  const box = "rounded-lg border-[1.5px] bg-surface px-3 py-2 font-normal text-foreground outline-none focus:border-primary";
  const border = error ? "border-danger" : "border-line-strong";

  return (
    <div className="flex flex-col gap-1 text-sm font-medium">
      <label htmlFor={inputId}>{label}</label>
      <div className="flex gap-2">
        <select
          aria-label="Country code"
          value={country}
          onChange={(event) => onCountryChange(event.target.value as CountryCode)}
          className={cn(box, border, "w-28 shrink-0")}
        >
          {DIAL_CODES.map((option) => (
            <option key={option.country} value={option.country}>
              {flag(option.country)} +{option.code} {option.name}
            </option>
          ))}
        </select>
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
          className={cn(box, border, "min-w-0 flex-1 placeholder:text-muted/80")}
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
