"use client";

import { PlaceholderBlock } from "@/components/landing/placeholder-block";
import { ButtonLink } from "@/components/ui/button";
import { DisplayTitle, SectionTitle } from "@/components/ui/typography";
import { useSession } from "@/lib/auth/session";

const PANELS = [
  { title: "Upcoming trips", note: "Your next trip, with everything booked for it (M4)" },
  { title: "Carts", note: "Your trips and what's in them, ready to check out (M4)" },
  { title: "Bookings", note: "Past and upcoming bookings, and their status (M4)" },
  { title: "Messages", note: "Chat with partners about a listing or booking (M6)" },
  { title: "Profile", note: "Your name, phone and sign-in methods (M1)" },
];

// The guest dashboard: where guests land after signing in. A skeleton until trips,
// carts and bookings exist.
export default function GuestDashboard() {
  const session = useSession();

  return (
    <main data-testid="guest-dashboard" className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-12">
      <div className="flex flex-col gap-4">
        <DisplayTitle>Hi, {session?.user.name ?? session?.user.email}</DisplayTitle>
        <div>
          <ButtonLink href="/" size="sm">
            Find a destination
          </ButtonLink>
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <SectionTitle>Your trips</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          {PANELS.map((panel) => (
            <PlaceholderBlock key={panel.title} {...panel} />
          ))}
        </div>
      </section>
    </main>
  );
}
