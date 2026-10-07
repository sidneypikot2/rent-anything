import type { ReactNode } from "react";
import { RoleGuard } from "@/components/auth/role-guard";
import { ProfileBanner } from "@/components/partner/profile-banner";
import { VerificationBanner } from "@/components/partner/verification-banner";

// Every partner page except /partner/login and /partner/register lives in this group,
// behind the guard. The incomplete-profile and ID-check banners sit inside it, so they only
// ask the API once it has confirmed this is a partner.
export default function ProtectedPartnerLayout({ children }: { children: ReactNode }) {
  return (
    <RoleGuard role="partner">
      <ProfileBanner />
      <VerificationBanner />
      {children}
    </RoleGuard>
  );
}
