"use client";

import { createPortal } from "react-dom";
import { useFloatingDock } from "@/components/discovery/floating-dock";
import { useTripHere } from "@/components/trips/use-trip-here";
import { ButtonLink } from "@/components/ui/button";

// Plan a trip, in the window's foot bar beside the phone's Map (floating-dock.ts), so it stays in
// reach once the banner has scrolled away (RAA-252). Below lg only, as Map is; the banner and the
// closing band hold it on a wide screen. Partners and admins don't plan trips.
export function PlanDock({ href, label, places }: { href: string; label: string; places: string[] }) {
  const dock = useFloatingDock();
  const { session, isGuest } = useTripHere(places);
  if (!dock || (session && !isGuest)) return null;
  return createPortal(
    <ButtonLink href={href} data-testid="plan-trip-dock" data-floating size="md" arrow className="order-2 lg:hidden">
      {label}
    </ButtonLink>,
    dock,
  );
}
