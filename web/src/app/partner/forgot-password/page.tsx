import type { Metadata } from "next";
import { PartnerAuthFrame } from "@/components/auth/auth-sheet";
import { ForgotPassword } from "@/components/auth/password-reset";
import { PartnerPitch } from "@/components/landing/partner-pitch";

export const metadata: Metadata = {
  title: "Partner forgot password",
};

// A partner asks for a link to choose a new password (RAA-215). Public, like /partner/login.
export default function PartnerForgotPassword() {
  return (
    <PartnerAuthFrame pitch={<PartnerPitch />}>
      <ForgotPassword role="partner" />
    </PartnerAuthFrame>
  );
}
