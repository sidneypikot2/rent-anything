import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { safeNextPath } from "@/lib/auth/paths";

export const metadata: Metadata = {
  title: "Sign in",
};

// Guest sign-in; guests sign up at /register, partners use /partner/login.
export default async function GuestLogin(props: PageProps<"/login">) {
  const next = safeNextPath((await props.searchParams).next);
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-12">
      <AuthCard role="guest" mode="signin" next={next} />
    </main>
  );
}
