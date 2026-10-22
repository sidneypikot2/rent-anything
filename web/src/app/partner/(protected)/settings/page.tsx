import { PlaceholderBlock } from "@/components/landing/placeholder-block";
import { PayoutSettings } from "@/components/partner/payout-settings";
import { DisplayTitle } from "@/components/ui/typography";

const PANELS = [
  { title: "Sign-in methods", note: "Password, Google and Facebook (M1)" },
  { title: "Notifications", note: "Which booking and message alerts reach you, and how" },
  { title: "Language and currency", note: "How dates, times and prices are shown to you" },
];

// The partner's settings: payouts (RAA-146), and placeholders for the account settings still
// to come (M1).
export default function PartnerSettings() {
  return (
    <main data-testid="partner-settings" className="mx-auto flex w-full max-w-page flex-1 flex-col gap-section px-gutter py-page-pad">
      <DisplayTitle>Settings</DisplayTitle>
      <div className="w-full max-w-narrow">
        <PayoutSettings />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {PANELS.map((panel) => (
          <PlaceholderBlock key={panel.title} {...panel} />
        ))}
      </div>
    </main>
  );
}
