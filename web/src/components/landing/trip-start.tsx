"use client";

import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { useSession } from "@/lib/auth/session";

// Where the platform launches. "Start your trip" lands on its things to book, with the
// banner that says the trip has started (RAA-80).
const LAUNCH_AREA = "bantayan-island";

// The hero's way in. A traveller, signed in or not, starts a trip; partners and admins have
// no cart, so, as in PlanCta, they are sent to their own work instead (RAA-80).
const ROWS = {
  traveller: { note: "Free to save", href: `/${LAUNCH_AREA}?start=trip#listings`, action: "Start your trip" },
  partner: { note: "How travellers plan with your listings", href: "/partner/listings", action: "Your listings" },
  admin: { note: "Signed in as an admin", href: "/admin", action: "Admin console" },
};

export function TripStart({ className }: { className?: string }) {
  const session = useSession();
  const role = session?.user.role;
  const row = ROWS[role === "partner" || role === "admin" ? role : "traveller"];

  return (
    <div className={cn("flex min-h-11 items-center justify-between gap-x-3", className)}>
      {/* The session lives in localStorage: until it has been read, the row keeps its height
          and shows nothing, so no one sees another role's button first. */}
      {session !== undefined && (
        <>
          <p className="min-w-0 text-sm text-muted">{row.note}</p>
          <ButtonLink href={row.href} variant="primary" size="sm" className="min-h-11 shrink-0 whitespace-nowrap">
            {row.action}
          </ButtonLink>
        </>
      )}
    </div>
  );
}
