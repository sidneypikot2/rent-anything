import { PlaceholderBlock } from "@/components/landing/placeholder-block";
import { DisplayTitle, SectionTitle } from "@/components/ui/typography";
import { BRAND } from "@/lib/brand";

const STEPS = [
  { title: "1. Verify your ID", note: "Government ID and a selfie, checked by Didit before you list" },
  { title: "2. List what you offer", note: "Publish each listing yourself once it's complete" },
  { title: "3. Get booked", note: "Instant book or accept requests from guests" },
  { title: "4. Get paid", note: "Earn from each completed booking, minus commission" },
];

// What partners read beside the form on /partner/login and /partner/register.
export function PartnerPitch() {
  return (
    <div className="flex flex-col gap-6">
      <DisplayTitle>List with {BRAND}</DisplayTitle>
      <p className="text-lg text-muted">
        Rental shops, tour guides, van operators and guesthouses, from the islands to the
        mountains: reach travellers who book their whole trip in one place.
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
