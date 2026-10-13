import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { safeNextPath } from "@/lib/auth/paths";
import { PageSheet } from "@/components/landing/page-sheet";

export const metadata: Metadata = {
  title: "Create an account",
};

// Guest sign-up: an account made here is a guest. Partners sign up at /partner/register.
export default async function GuestRegister(props: PageProps<"/register">) {
  const next = safeNextPath((await props.searchParams).next);
  return (
    <main className="flex flex-1 flex-col pt-3 sm:pt-6">
      <PageSheet>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-gutter py-page-pad">
          <AuthCard role="guest" mode="signup" next={next} />
        </div>
      </PageSheet>
    </main>
  );
}
