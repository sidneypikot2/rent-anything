import { PlaceholderBlock } from "@/components/landing/placeholder-block";
import { DisplayTitle, SectionTitle } from "@/components/ui/typography";

const STEPS = [
  { title: "1. Verify your ID", note: "Government ID and a selfie, reviewed by our team" },
  { title: "2. List what you offer", note: "Each listing is approved before it goes live" },
  { title: "3. Get booked", note: "Instant book or accept requests from guests" },
  { title: "4. Get paid", note: "Payouts after each completed booking, minus commission" },
];

// What partners read beside the form on /partner/login and /partner/register.
export function PartnerPitch() {
  return (
    <div className="flex flex-col gap-6">
      <DisplayTitle>List with Rent-Anything</DisplayTitle>
      <p className="text-lg text-muted">
        Rental shops, tour operators, van operators and guesthouses in Moalboal: reach travellers
        who book their whole trip in one place.
      </p>
      <section className="flex flex-col gap-3">
        <SectionTitle>How it works</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          {STEPS.map((step) => (
            <PlaceholderBlock key={step.title} {...step} />
          ))}
        </div>
      </section>
    </div>
  );
}
