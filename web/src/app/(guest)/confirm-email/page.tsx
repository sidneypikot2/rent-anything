import type { Metadata } from "next";
import { ConfirmEmail } from "@/components/auth/confirm-email";
import { PageSheet } from "@/components/landing/page-sheet";

export const metadata: Metadata = {
  title: "Confirm your email",
  robots: { index: false },
};

// The link in the confirmation email (RAA-214 sends it, RAA-215): confirms the account's email
// with the token, signed in or not.
export default async function ConfirmEmailPage(props: PageProps<"/confirm-email">) {
  const { token } = await props.searchParams;
  return (
    <main className="flex flex-1 flex-col pt-3 sm:pt-6">
      <PageSheet>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-gutter py-page-pad">
          <ConfirmEmail token={typeof token === "string" ? token : undefined} />
        </div>
      </PageSheet>
    </main>
  );
}
