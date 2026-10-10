import { ButtonLink } from "@/components/ui/button";

const TARGETS = {
  guest: { href: "/", label: "Guest site" },
  partner: { href: "/partner", label: "Partner site" },
};

// Opt-in: on locally, and on staging through NEXT_PUBLIC_SECTION_SWITCH (set in Vercel), so a
// production host never shows it unless asked to (RAA-87).
const ENABLED =
  process.env.NODE_ENV === "development" || process.env.NEXT_PUBLIC_SECTION_SWITCH === "true";

// A floating jump between the guest and partner sites, for testing on staging. The product
// keeps the two sections apart (see SectionHeader); this is the one link between them.
export function SectionSwitch({ to }: { to: keyof typeof TARGETS }) {
  if (!ENABLED) return null;
  const { href, label } = TARGETS[to];

  return (
    <ButtonLink
      href={href}
      variant="secondary"
      size="touch"
      title="Test aid: not shown in production"
      className="fixed right-4 bottom-4 z-40 shadow-lg"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5">
        <path
          d="M7 7h12m0 0-3-3m3 3-3 3M17 17H5m0 0 3-3m-3 3 3 3"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {label}
    </ButtonLink>
  );
}
