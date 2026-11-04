import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { AuthSheet } from "@/components/auth/auth-sheet";
import { safeNextPath } from "@/lib/auth/paths";

export const metadata: Metadata = {
  title: "Sign in",
};

// Guest sign-in; guests sign up at /register, partners use /partner/login.
export default async function GuestLogin(props: PageProps<"/login">) {
  const next = safeNextPath((await props.searchParams).next);
  return (
    <AuthSheet>
      <AuthCard role="guest" mode="signin" next={next} headingLevel="h1" plain />
    </AuthSheet>
  );
}
