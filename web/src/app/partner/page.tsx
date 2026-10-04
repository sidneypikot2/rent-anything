import type { Metadata } from "next";
import { AuthCard } from "@/components/landing/auth-card";
import { PlaceholderBlock } from "@/components/landing/placeholder-block";
import { DisplayTitle, SectionTitle } from "@/components/ui/typography";

export const metadata: Metadata = {
  title: "Partners · Rent-Anything",
  description: "List your tours, transfers, rentals and stays with Rent-Anything.",
};

const STEPS = [
  { title: "1. Verify your ID", note: "Government ID and a selfie, reviewed by our team" },
  { title: "2. List what you offer", note: "Each listing is approved before it goes live" },
  { title: "3. Get booked", note: "Instant book or accept requests from guests" },
  { title: "4. Get paid", note: "Payouts after each completed booking, minus commission" },
];

// The partner (supplier) landing page. Sign-ups here will create partner accounts (M1).
export default function PartnerHome() {
  return (
    <main className="mx-auto grid w-full max-w-5xl flex-1 gap-10 px-4 py-12 md:grid-cols-[1fr_20rem]">
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
      <AuthCard mode="signup" audience="partner" title="Become a partner" />
    </main>
  );
}
