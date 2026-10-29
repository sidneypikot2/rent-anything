import { PlaceholderBlock } from "@/components/landing/placeholder-block";
import { PayoutSettings } from "@/components/partner/payout-settings";
import { Card, CardBody } from "@/components/ui/card";
import { DisplayTitle } from "@/components/ui/typography";
import { SUPPORT_EMAIL } from "@/lib/brand";

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
      {/* Partners can't delete themselves: their listings, businesses and payouts are closed by the team. */}
      <Card className="w-full max-w-narrow" data-testid="partner-close-account">
        <CardBody>
          <h2 className="font-semibold">Close your account</h2>
          <p className="mt-1 text-sm text-pretty text-muted">
            Email{" "}
            <a href={`mailto:${SUPPORT_EMAIL}?subject=Close my partner account`} className="font-semibold text-link underline underline-offset-4">
              {SUPPORT_EMAIL}
            </a>{" "}
            from your account&apos;s email address. We finish your open bookings and payouts with you, then delete your account.
          </p>
        </CardBody>
      </Card>
    </main>
  );
}
