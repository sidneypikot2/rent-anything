// The product's name and line, chosen by the team on 6 Oct 2026 (RAA-35, replacing
// Tripinas, which was taken). The repo, the API and the docs still say Rent-Anything until
// a full rename is decided; only what people see in the web app uses these. Never write the
// name out in a component — use these.
// The two halves of the wordmark, styled differently by <Logo>.
export const BRAND_PARTS = ["TripKo", "Next"] as const;
export const BRAND = BRAND_PARTS.join("");
// No trailing period: add punctuation where text follows it.
export const TAGLINE = "Your Whole Trip in One Cart";

// Our social accounts, linked from the guest footer.
export const SOCIALS = {
  facebook: "https://www.facebook.com/profile.php?id=61591923239500",
  instagram: "https://www.instagram.com/tripkonext",
  tiktok: "https://www.tiktok.com/@tripkonext",
} as const;

// Where people write to us: support, and partners asking to close their account. The team's
// mailbox (production's mail account, .claude/rules/email.md).
export const SUPPORT_EMAIL = "team@tripkonext.com";

// Where the business is, shown in the guest footer with the name and SUPPORT_EMAIL, so
// travellers can see who runs the site.
export const BUSINESS_ADDRESS = "Santa Fe, Bantayan Island, Cebu";
