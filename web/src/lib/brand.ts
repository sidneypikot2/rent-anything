// The product's name and line, chosen by the team on 6 Oct 2026 (RAA-35, replacing
// Tripinas, which was taken). The repo, the API and the docs still say Rent-Anything until
// a full rename is decided; only what people see in the web app uses these. Never write the
// name out in a component — use these.
// The two halves of the wordmark, styled differently by <Logo>.
export const BRAND_PARTS = ["TripKo", "Next"] as const;
export const BRAND = BRAND_PARTS.join("");
// No trailing period: add punctuation where text follows it.
export const TAGLINE = "Your Whole Trip in One Cart";
