import type { ReactNode } from "react";
import { RoleGuard } from "@/components/auth/role-guard";
import { PageSheet } from "@/components/landing/page-sheet";
import { ProfileBanner } from "@/components/partner/profile-banner";
import { VerificationBanner } from "@/components/partner/verification-banner";

// Every partner page except /partner/login and /partner/register lives in this group,
// behind the guard, on a white sheet (RAA-120) rather than the guests' glass, wrapped here once:
// none has a banner of its own. The incomplete-profile and ID-check banners sit inside it, so they only
// ask the API once it has confirmed this is a partner.
export default function ProtectedPartnerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col pt-3 sm:pt-6">
      <PageSheet tone="paper">
        <RoleGuard role="partner">
          <ProfileBanner />
          <VerificationBanner />
          {children}
        </RoleGuard>
      </PageSheet>
    </div>
  );
}
