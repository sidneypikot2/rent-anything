import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { PartnerAuthFrame } from "@/components/auth/auth-sheet";
import { PartnerPitch } from "@/components/landing/partner-pitch";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Become a partner",
  description: `List your tours, transfers, rentals and stays with ${BRAND}.`,
};

// Partner sign-up: an account made here is a partner. Public, like /partner/login.
export default function PartnerRegister() {
  return (
    <PartnerAuthFrame pitch={<PartnerPitch />}>
      <AuthCard role="partner" mode="signup" plain />
    </PartnerAuthFrame>
  );
}
