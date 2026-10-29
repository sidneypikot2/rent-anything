import { isValidPhoneNumber, parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";
import { countryName } from "./countries";

// Phone numbers are typed after a country code (+63 unless the guest picks another), checked
// with libphonenumber-js and saved as one international number (+639171234567). Partners
// stay on +63 (RAA-40); guests can pick any country.

// "+63 917 123 4567", for showing a saved number.
export function formatPhone(phone: string | null) {
  return phone ? (parsePhoneNumberFromString(phone)?.formatInternational() ?? phone) : null;
}

// What goes back in the field after +63 when a saved number is edited; a number from
// elsewhere keeps its own + code.
export function editablePhone(phone: string | null) {
  const parsed = phone ? parsePhoneNumberFromString(phone, "PH") : undefined;
  return parsed?.country === "PH" ? parsed.nationalNumber : (phone ?? "");
}

// A saved number split into its country and the digits after the code, for a field with a
// country picker. A number it can't place stays as typed, under the Philippines.
export function phoneParts(phone: string | null): { country: CountryCode; number: string } {
  const parsed = phone ? parsePhoneNumberFromString(phone, "PH") : undefined;
  if (parsed?.country) return { country: parsed.country, number: parsed.nationalNumber };
  return { country: "PH", number: phone ?? "" };
}

// The number to send, or undefined when it isn't a valid number for that country.
export function toE164(number: string, country: CountryCode = "PH") {
  return isValidPhoneNumber(number, country) ? parsePhoneNumberFromString(number, country)?.number : undefined;
}

export const PHONE_ERROR = "Enter a valid Philippine number, e.g. 917 123 4567";

// The error for a number that doesn't check out in the picked country.
export function phoneError(country: CountryCode) {
  return country === "PH" ? PHONE_ERROR : `Enter a valid ${countryName(country)} number`;
}
