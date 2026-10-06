// A country's English name from its ISO 3166-1 alpha-2 code (what the API stores).
const names = new Intl.DisplayNames(["en"], { type: "region" });

export function countryName(code: string) {
  return names.of(code) ?? code;
}
