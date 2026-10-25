import type { Metadata } from "next";
import { CodeSignIn } from "@/components/auth/code-sign-in";
import { PageSheet } from "@/components/landing/page-sheet";
import { safeNextPath } from "@/lib/auth/paths";

export const metadata: Metadata = {
  title: "Sign in with a code",
};

// Guest sign-in with an emailed code (RAA-177), for guests who booked without a password.
export default async function GuestCodeLogin(props: PageProps<"/login/code">) {
  const next = safeNextPath((await props.searchParams).next);
  return (
    <main className="flex flex-1 flex-col pt-3 sm:pt-6">
      <PageSheet>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-gutter py-page-pad">
          <CodeSignIn next={next} />
        </div>
      </PageSheet>
    </main>
  );
}
