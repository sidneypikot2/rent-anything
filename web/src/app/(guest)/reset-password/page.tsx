import type { Metadata } from "next";
import { ResetPassword } from "@/components/auth/password-reset";
import { PageSheet } from "@/components/landing/page-sheet";

export const metadata: Metadata = {
  title: "Choose a new password",
  robots: { index: false },
};

// The link in the password reset email (RAA-214 sends it, RAA-215), for guests and partners alike:
// the token says whose password it is.
export default async function ResetPasswordPage(props: PageProps<"/reset-password">) {
  const { token } = await props.searchParams;
  return (
    <main className="flex flex-1 flex-col pt-3 sm:pt-6">
      <PageSheet>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-gutter py-page-pad">
          <ResetPassword token={typeof token === "string" ? token : undefined} />
        </div>
      </PageSheet>
    </main>
  );
}
