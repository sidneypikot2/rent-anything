"use client";

import type { ReactNode } from "react";
import { useAdminBookings } from "@/components/admin/use-admin-bookings";
import { CONSOLE_ICON as ICON, ConsoleShell, type ConsoleTab } from "@/components/console/console-shell";
import { CompassGlyph, HomeGlyph, PlaceGlyph, TicketGlyph } from "@/components/discovery/tag-glyphs";

// The admin console's tabs (RAA-142), on the partner dashboard's shell (RAA-289): a rail of icons
// from `md`, a bar along the window's foot on a phone. Overview (RAA-290's figures) comes first.
// Booking requests carries those waiting for an answer (the same query the requests page reads,
// so it's asked once).
export function AdminShell({ children }: { children: ReactNode }) {
  const requests = useAdminBookings("requested").data?.length ?? 0;
  const tabs: ConsoleTab[] = [
    { id: "overview", href: "/admin/dashboard", label: "Overview", icon: <HomeGlyph className={ICON} />, onBar: true },
    { id: "bookings", href: "/admin/bookings", label: "Booking requests", barLabel: "Requests", icon: <TicketGlyph className={ICON} />, onBar: true, count: requests },
    { id: "destinations", href: "/admin/destinations", label: "Destinations", icon: <CompassGlyph className={ICON} />, onBar: true },
    { id: "landmarks", href: "/admin/landmarks", label: "Places to see", icon: <PlaceGlyph className={ICON} />, onBar: true },
  ];

  return (
    <ConsoleShell role="admin" tabs={tabs}>
      {children}
    </ConsoleShell>
  );
}
