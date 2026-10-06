import type { ReactNode } from "react";
import { RoleGuard } from "@/components/auth/role-guard";
import { ProfileBanner } from "@/components/partner/profile-banner";

// Every partner page except /partner/login and /partner/register lives in this group,
// behind the guard. The incomplete-profile banner sits inside it, so it only asks for the
// profile once the API has confirmed this is a partner.
export default function ProtectedPartnerLayout({ children }: { children: ReactNode }) {
  return (
    <RoleGuard role="partner">
      <ProfileBanner />
      {children}
    </RoleGuard>
  );
}
