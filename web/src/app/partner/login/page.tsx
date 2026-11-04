import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { PartnerAuthFrame } from "@/components/auth/auth-sheet";
import { PartnerPitch } from "@/components/landing/partner-pitch";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Partner sign in",
  description: `List your tours, transfers, rentals and stays with ${BRAND}.`,
};

// Partner sign-in; new partners sign up at /partner/register. These two are the only
// public partner pages: every other one needs a partner account (RoleGuard).
export default function PartnerLogin() {
  return (
    <PartnerAuthFrame pitch={<PartnerPitch />}>
      <AuthCard role="partner" mode="signin" plain />
    </PartnerAuthFrame>
  );
}
