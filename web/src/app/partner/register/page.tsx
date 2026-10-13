import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { PartnerPitch } from "@/components/landing/partner-pitch";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Become a partner",
  description: `List your tours, transfers, rentals and stays with ${BRAND}.`,
};

// Partner sign-up: an account made here is a partner. Public, like /partner/login.
export default function PartnerRegister() {
  return (
    <main className="mx-auto grid w-full max-w-page flex-1 gap-block px-gutter py-page-pad md:grid-cols-[1fr_20rem]">
      <PartnerPitch />
      <AuthCard role="partner" mode="signup" />
    </main>
  );
}
