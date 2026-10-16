"use client";

import Image from "next/image";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { REGISTER_PATHS } from "@/lib/auth/paths";
import { useSession } from "@/lib/auth/session";
import { BAND_PHOTO } from "./sample-photos";

// The home page's closing band (RAA-73). Signed out it asks for an account; a guest already
// has one and is sent to their trips. Partners and admins have no cart, so since RAA-78 they
// are sent to their own work instead.
// The session lives in localStorage, so until it has been read the signed-out band holds the
// place, hidden: no one sees the wrong band first, and the page doesn't grow when it arrives.
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
  const band = BANDS[session ? session.user.role : "signedOut"];

  // A forest band over a photo (RAA-130): green marks trips, the button on it stays blue.
  return (
    <section
      className={cn(
        "band reveal card-edge relative isolate flex flex-col items-start gap-5 overflow-hidden rounded-frame px-inset py-7 text-white sm:flex-row sm:items-center sm:justify-between sm:gap-8 sm:py-10",
        session === undefined && "invisible",
      )}
    >
      <Image src={BAND_PHOTO} alt="" fill sizes="(min-width: 72rem) 72rem, 100vw" className="-z-20 object-cover" />
      <div aria-hidden className="absolute inset-0 -z-10 bg-forest/86" />
      <div>
        {/* Smaller than a section title (RAA-130): a closing line, not a section. */}
        <h2 className="font-display text-[clamp(1.5rem,4vw,1.875rem)] leading-[1.1] font-extrabold tracking-tight text-balance">
          {band.title}
        </h2>
        <p className="mt-2 max-w-lede text-pretty text-sky-mist">{band.body}</p>
      </div>
      <ButtonLink href={band.href} arrow className="shrink-0 sm:whitespace-nowrap">
        {band.action}
      </ButtonLink>
    </section>
  );
}
