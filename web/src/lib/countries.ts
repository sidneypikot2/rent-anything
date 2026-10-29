import { getCountries, getCountryCallingCode, type CountryCode } from "libphonenumber-js";

// A country's English name from its ISO 3166-1 alpha-2 code (what the API stores).
const names = new Intl.DisplayNames(["en"], { type: "region" });

export function countryName(code: string) {
  return names.of(code) ?? code;
}

// The country's flag, from its two letters (regional indicator symbols).
export function countryFlag(code: string) {
  return String.fromCodePoint(...[...code.toUpperCase()].map((letter) => 0x1f1a5 + letter.charCodeAt(0)));
}

export type Country = { code: CountryCode; name: string; dial: string };

// Every country with a phone code, by name, the Philippines first: guests come from
// anywhere (the guest profile and checkout), partners are in the Philippines.
export const COUNTRIES: Country[] = getCountries()
  .map((code) => ({ code, name: countryName(code), dial: getCountryCallingCode(code) }))
  .sort((a, b) => (a.code === "PH" ? -1 : b.code === "PH" ? 1 : a.name.localeCompare(b.name)));
