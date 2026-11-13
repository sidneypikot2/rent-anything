import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { AuthSheet } from "@/components/auth/auth-sheet";
import { LOGIN_PATHS, RESET_DONE_FLAG, safeNextPath } from "@/lib/auth/paths";
import { NOINDEX } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Sign in",
  // Sign-in pages stay out of search results (RAA-227).
  robots: NOINDEX,
};

// Guest sign-in; guests sign up at /register, partners use /partner/login.
export default async function GuestLogin(props: PageProps<"/login">) {
  const params = await props.searchParams;
  const next = safeNextPath(params.next);
  // Sent here by /reset-password once the password has changed (RAA-215).
  // The reset doesn't say whose account it was, so a partner is pointed to their own page.
  const notice = params[RESET_DONE_FLAG] ? (
    <>
      Your password is changed. Sign in with the new one{" "}
      (a partner account?{" "}
      <Link href={LOGIN_PATHS.partner} className="underline">
        partner sign-in
      </Link>
      ).
    </>
  ) : undefined;
  return (
    <AuthSheet>
      <AuthCard role="guest" mode="signin" next={next} headingLevel="h1" plain notice={notice} />
    </AuthSheet>
  );
}
