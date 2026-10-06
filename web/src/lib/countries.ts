// Countries a partner's business address can be in, as ISO 3166-1 alpha-2 codes (what the
// API stores). The Philippines first; the rest are where partners are most likely from.
const CODES = [
  "PH", "AU", "CA", "CN", "DE", "ES", "FR", "GB", "HK", "ID", "IN", "IT", "JP", "KR",
  "MY", "NL", "NZ", "SG", "TH", "TW", "US", "VN",
];

const names = new Intl.DisplayNames(["en"], { type: "region" });

export const DEFAULT_COUNTRY = "PH";

export function countryName(code: string) {
  return names.of(code) ?? code;
}

export const COUNTRY_OPTIONS = [
  { value: "PH", label: countryName("PH") },
  ...CODES.slice(1)
    .map((code) => ({ value: code, label: countryName(code) }))
    .sort((a, b) => a.label.localeCompare(b.label)),
];
