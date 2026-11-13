import type { Metadata } from "next";
import type { ReactNode } from "react";
import { RoleGuard } from "@/components/auth/role-guard";
import { GuestProfileBanner } from "@/components/guest/profile-banner";
import { NOINDEX } from "@/lib/seo";

// A guest's own pages never go in search results (RAA-227).
export const metadata: Metadata = { robots: NOINDEX };

// Signed-in guest pages (dashboard, profile, settings, later bookings), behind the guard.
// The incomplete-profile banner sits inside it, so it only asks for the profile once the
// API has confirmed this is a guest.
export default function SignedInGuestLayout({ children }: { children: ReactNode }) {
  return (
    <RoleGuard role="guest">
      <GuestProfileBanner />
      {children}
    </RoleGuard>
  );
}
