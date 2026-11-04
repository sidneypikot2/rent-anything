import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { AuthSheet } from "@/components/auth/auth-sheet";
import { safeNextPath } from "@/lib/auth/paths";

export const metadata: Metadata = {
  title: "Create an account",
};

// Guest sign-up: an account made here is a guest. Partners sign up at /partner/register.
export default async function GuestRegister(props: PageProps<"/register">) {
  const next = safeNextPath((await props.searchParams).next);
  return (
    <AuthSheet>
      <AuthCard role="guest" mode="signup" next={next} headingLevel="h1" plain />
    </AuthSheet>
  );
}
