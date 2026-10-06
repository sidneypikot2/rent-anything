import { isValidPhoneNumber, parsePhoneNumberFromString } from "libphonenumber-js";

// Profiles take Philippine numbers for now (RAA-40): typed after a fixed +63, checked with
// libphonenumber-js and saved as one international number (+639171234567).

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

// The number to send, or undefined when it isn't a valid Philippine number.
export function toE164(number: string) {
  return isValidPhoneNumber(number, "PH") ? parsePhoneNumberFromString(number, "PH")?.number : undefined;
}

export const PHONE_ERROR = "Enter a valid Philippine number, e.g. 917 123 4567";
