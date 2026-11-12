import type { Metadata } from "next";
import { AuthSheet } from "@/components/auth/auth-sheet";
import { ForgotPassword } from "@/components/auth/password-reset";

export const metadata: Metadata = {
  title: "Forgot password",
};

// A guest asks for a link to choose a new password (RAA-215); partners use /partner/forgot-password.
export default function GuestForgotPassword() {
  return (
    <AuthSheet>
      <ForgotPassword role="guest" />
    </AuthSheet>
  );
}
