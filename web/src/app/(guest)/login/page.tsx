import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";

export const metadata: Metadata = {
  title: "Sign in · Rent-Anything",
};

// Guest sign-in and sign-up. A sign-up here creates a guest; partners use /partner/login.
export default function GuestLogin() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-12">
      <AuthCard role="guest" />
    </main>
  );
}
