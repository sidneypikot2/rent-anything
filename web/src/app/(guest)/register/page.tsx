import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";

export const metadata: Metadata = {
  title: "Create an account · Rent-Anything",
};

// Guest sign-up: an account made here is a guest. Partners sign up at /partner/register.
export default function GuestRegister() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-12">
      <AuthCard role="guest" mode="signup" />
    </main>
  );
}
