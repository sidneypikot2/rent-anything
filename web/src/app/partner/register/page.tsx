import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { PartnerAuthFrame } from "@/components/auth/auth-sheet";
import { PartnerPitch } from "@/components/landing/partner-pitch";
import { BRAND } from "@/lib/brand";
import { NOINDEX } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Become a partner",
  description: `List your tours, transfers, rentals and stays with ${BRAND}.`,
  // Sign-in pages stay out of search results (RAA-227).
  robots: NOINDEX,
};

// Partner sign-up: an account made here is a partner. Public, like /partner/login.
export default function PartnerRegister() {
  return (
    <PartnerAuthFrame pitch={<PartnerPitch />}>
      <AuthCard role="partner" mode="signup" plain />
    </PartnerAuthFrame>
  );
}
