"use client";

import { ButtonLink } from "@/components/ui/button";
import { SectionTitle } from "@/components/ui/typography";
import { REGISTER_PATHS } from "@/lib/auth/paths";
import { useSession } from "@/lib/auth/session";

// The home page's closing band (RAA-73). Signed out it asks for an account; a guest already
// has one and is sent to their trips. Partners and admins have no cart, so since RAA-78 they
// are sent to their own work instead.
// Nothing renders until the session has been read (it lives in localStorage), so no one sees
// the wrong band first; it is the last thing on the page, below the fold.
const BANDS = {
  signedOut: {
    title: "Start planning your trip",
    body: "Save tours, rides, gear and stays from local partners to trips that span every place you visit. A free account keeps them all in one cart.",
    href: REGISTER_PATHS.guest,
    action: "Create an account",
  },
  guest: {
    title: "Pick up where you left off",
    body: "Your trips and everything you've saved to them are in your cart.",
    href: "/cart",
    action: "Go to your trips",
  },
  partner: {
    title: "What travellers can book from you",
    body: "Keep your listings current, or add something new for the season.",
    href: "/partner/listings",
    action: "Your listings",
  },
  admin: {
    title: "Signed in as an admin",
    body: "The team's tools are in the admin console.",
    href: "/admin",
    action: "Open the admin console",
  },
};

export function PlanCta() {
  const session = useSession();
  if (session === undefined) return null;
  const band = BANDS[session ? session.user.role : "signedOut"];

  return (
    <section className="flex flex-col items-start gap-4 rounded-3xl bg-navy p-8 text-white sm:flex-row sm:items-center sm:justify-between">
      <div>
        <SectionTitle>{band.title}</SectionTitle>
        <p className="mt-1 text-on-dark">{band.body}</p>
      </div>
      <ButtonLink href={band.href} variant="accent" className="shrink-0 whitespace-nowrap">
        {band.action}
      </ButtonLink>
    </section>
  );
}
