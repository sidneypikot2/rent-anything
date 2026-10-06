import type { ReactNode } from "react";
import { RoleGuard } from "@/components/auth/role-guard";
import { GuestProfileBanner } from "@/components/guest/profile-banner";

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
