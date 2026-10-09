import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { safeNextPath } from "@/lib/auth/paths";

export const metadata: Metadata = {
  title: "Create an account",
};

// Guest sign-up: an account made here is a guest. Partners sign up at /partner/register.
export default async function GuestRegister(props: PageProps<"/register">) {
  const next = safeNextPath((await props.searchParams).next);
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-12">
      <AuthCard role="guest" mode="signup" next={next} />
    </main>
  );
}
