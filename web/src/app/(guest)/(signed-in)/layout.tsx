import type { ReactNode } from "react";
import { RoleGuard } from "@/components/auth/role-guard";

// Signed-in guest pages (dashboard, profile, settings, later bookings), behind the guard.
export default function SignedInGuestLayout({ children }: { children: ReactNode }) {
  return <RoleGuard role="guest">{children}</RoleGuard>;
}
