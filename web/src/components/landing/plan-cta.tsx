"use client";

import { ButtonLink } from "@/components/ui/button";
import { SectionTitle } from "@/components/ui/typography";
import { REGISTER_PATHS } from "@/lib/auth/paths";
import { useSession } from "@/lib/auth/session";

// The home page's closing band (RAA-73). Signed out (and while the session is still being
// read, so the band doesn't jump) it asks for an account; a guest already has one and is
// sent to their trips; partners and admins have no cart, so they don't see it.
export function PlanCta() {
  const session = useSession();
  if (session && session.user.role !== "guest") return null;
  const guest = Boolean(session);

  return (
    <section className="flex flex-col items-start gap-4 rounded-3xl bg-navy p-8 text-white sm:flex-row sm:items-center sm:justify-between">
      <div>
        <SectionTitle>{guest ? "Pick up where you left off" : "Start planning your trip"}</SectionTitle>
        <p className="mt-1 text-on-dark">
          {guest
            ? "Your trips and everything you've saved to them are in your cart."
            : "Save tours, rides, gear and stays from local partners to trips that span every place you visit. A free account keeps them all in one cart."}
        </p>
      </div>
      <ButtonLink
        href={guest ? "/cart" : REGISTER_PATHS.guest}
        variant="accent"
        className="shrink-0 whitespace-nowrap"
      >
        {guest ? "Go to your trips" : "Create an account"}
      </ButtonLink>
    </section>
  );
}
