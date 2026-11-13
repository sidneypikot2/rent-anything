import type { Metadata } from "next";
import { PartnerAuthFrame } from "@/components/auth/auth-sheet";
import { ForgotPassword } from "@/components/auth/password-reset";
import { PartnerPitch } from "@/components/landing/partner-pitch";
import { NOINDEX } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Partner forgot password",
  // Sign-in pages stay out of search results (RAA-227).
  robots: NOINDEX,
};

// A partner asks for a link to choose a new password (RAA-215). Public, like /partner/login.
export default function PartnerForgotPassword() {
  return (
    <PartnerAuthFrame pitch={<PartnerPitch />}>
      <ForgotPassword role="partner" />
    </PartnerAuthFrame>
  );
}
