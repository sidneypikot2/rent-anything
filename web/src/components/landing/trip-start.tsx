"use client";

import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { useSession } from "@/lib/auth/session";

// Where the platform launches. "Start your trip" lands on its things to book, with the
// banner that says the trip has started (RAA-80); the hero search offers it before anything
// is typed.
export const LAUNCH_AREA = { slug: "bantayan-island", name: "Bantayan Island", kind: "island" };

// The hero's way in. A traveller, signed in or not, starts a trip; partners and admins have
// no cart, so, as in PlanCta, they are sent to their own work instead (RAA-80). A line of
// text and a pale button on the hero photo, under the search, with no panel of its own, so
// it doesn't read as a second search box (RAA-108).
const ROWS = {
  traveller: { note: "Free to save", href: `/${LAUNCH_AREA.slug}?start=trip#listings`, action: "Start your trip" },
  partner: { note: "How travellers plan with your listings", href: "/partner/listings", action: "Your listings" },
  admin: { note: "Signed in as an admin", href: "/admin", action: "Admin console" },
};

// `wideHidden`: from lg the hero's destination card offers the traveller's way in (RAA-125),
// so their row steps aside there; a partner's or admin's stays.
export function TripStart({ className, wideHidden = false }: { className?: string; wideHidden?: boolean }) {
  const session = useSession();
  const role = session?.user.role;
  const row = ROWS[role === "partner" || role === "admin" ? role : "traveller"];

  // The session lives in localStorage, so the server and the first paint can't know the
  // role: they show the traveller's row, the one nearly every visitor needs, and a partner's
  // or admin's swaps in once the session has been read.
  return (
    <div
      className={cn(
        "flex min-h-11 flex-wrap items-center gap-x-4 gap-y-2",
        wideHidden && row === ROWS.traveller && "lg:hidden",
        className,
      )}
    >
      <ButtonLink href={row.href} variant="accent" size="sm" className="group min-h-11 shrink-0 whitespace-nowrap">
        {row.action}{" "}
        <span aria-hidden className="inline-flex transition-transform duration-300 ease-calm group-hover:translate-x-1">
          →
        </span>
      </ButtonLink>
      <p className="min-w-0 text-sm text-sky-mist">{row.note}</p>
    </div>
  );
}
