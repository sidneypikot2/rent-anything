import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";

export const metadata: Metadata = {
  title: "Sign in",
};

// Guest sign-in; guests sign up at /register, partners use /partner/login.
export default function GuestLogin() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-12">
      <AuthCard role="guest" mode="signin" />
    </main>
  );
}
