"use client";

import type { ReactNode } from "react";
import { CONSOLE_ICON as ICON, ConsoleShell, type ConsoleTab } from "@/components/console/console-shell";
import {
  CalendarGlyph,
  CogGlyph,
  HomeGlyph,
  InboxGlyph,
  ListGlyph,
  PersonGlyph,
  SuitcaseGlyph,
  TicketGlyph,
  WalletGlyph,
} from "@/components/discovery/tag-glyphs";
import { usePartnerRequests } from "@/components/partner/use-partner-calendar";

// A signed-in partner's pages (RAA-267), on the shell the admin console shares (ConsoleShell).
// Bookings carries the requests waiting for an answer; a phone's bar holds the first four tabs.
export function PartnerShell({ children }: { children: ReactNode }) {
  const requests = usePartnerRequests().data?.length ?? 0;
  const tabs: ConsoleTab[] = [
    { id: "home", href: "/partner/dashboard", label: "Dashboard", icon: <HomeGlyph className={ICON} />, onBar: true },
    { id: "bookings", href: "/partner/bookings", label: "Bookings", icon: <TicketGlyph className={ICON} />, onBar: true, count: requests },
    { id: "calendar", href: "/partner/calendar", label: "Calendar", icon: <CalendarGlyph className={ICON} />, onBar: true },
    { id: "inbox", href: "/partner/inbox", label: "Inbox", icon: <InboxGlyph className={ICON} /> },
    { id: "listings", href: "/partner/listings", label: "Listings", icon: <ListGlyph className={ICON} />, onBar: true },
    { id: "businesses", href: "/partner/businesses", label: "Businesses", icon: <SuitcaseGlyph className={ICON} /> },
    { id: "earnings", href: "/partner/earnings", label: "Earnings", icon: <WalletGlyph className={ICON} /> },
    { id: "profile", href: "/partner/profile", label: "Profile and ID", icon: <PersonGlyph className={ICON} />, also: ["/partner/verify"] },
    { id: "settings", href: "/partner/settings", label: "Account settings", icon: <CogGlyph className={ICON} /> },
  ];

  return (
    <ConsoleShell role="partner" tabs={tabs}>
      {children}
    </ConsoleShell>
  );
}
