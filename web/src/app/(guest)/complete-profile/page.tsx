import type { Metadata } from "next";
import { CompleteProfileCard } from "@/components/auth/complete-profile-card";

export const metadata: Metadata = {
  title: "Complete your profile · Rent-Anything",
};

// After sign-up: a guest's name and phone. Guarded by the card, not the (signed-in)
// group, whose guard would send an unfinished guest straight back here.
export default function GuestCompleteProfile() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-12">
      <CompleteProfileCard role="guest" />
    </main>
  );
}
