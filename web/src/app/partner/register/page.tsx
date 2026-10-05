import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { PartnerPitch } from "@/components/landing/partner-pitch";

export const metadata: Metadata = {
  title: "Become a partner · Rent-Anything",
  description: "List your tours, transfers, rentals and stays with Rent-Anything.",
};

// Partner sign-up: an account made here is a partner. Public, like /partner/login.
export default function PartnerRegister() {
  return (
    <main className="mx-auto grid w-full max-w-5xl flex-1 gap-10 px-4 py-12 md:grid-cols-[1fr_20rem]">
      <PartnerPitch />
      <AuthCard role="partner" mode="signup" />
    </main>
  );
}
