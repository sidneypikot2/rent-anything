// What a business's shop details mean in words (RAA-281): the languages and house rules the API
// allows, and the weekdays its closed days count from Sunday (0). The partner's business form and
// the guest's shop page both use these.
export const LANGUAGE_LABELS: Record<string, string> = {
  en: "English",
  tl: "Tagalog",
  ceb: "Cebuano",
  ilo: "Ilocano",
  ko: "Korean",
  zh: "Chinese",
  ja: "Japanese",
  de: "German",
  fr: "French",
  es: "Spanish",
};

export const HOUSE_RULE_LABELS: Record<string, string> = {
  no_smoking: "No smoking indoors",
  no_parties: "No parties",
  quiet_hours: "Quiet hours",
  no_visitors: "No visitors overnight",
};

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const MAX_FAQS = 6;

// "English, Cebuano and Tagalog".
export function listText(words: string[]) {
  return words.length <= 1 ? (words[0] ?? "") : `${words.slice(0, -1).join(", ")} and ${words.at(-1)}`;
}
