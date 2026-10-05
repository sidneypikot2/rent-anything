import type { Metadata } from "next";
import { CompleteProfileCard } from "@/components/auth/complete-profile-card";

export const metadata: Metadata = {
  title: "Complete your profile · Rent-Anything",
};

// After sign-up: a partner's name and phone. Outside the (protected) group, whose
// guard would send an unfinished partner straight back here; the card guards itself.
export default function PartnerCompleteProfile() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-12">
      <CompleteProfileCard role="partner" />
    </main>
  );
}
