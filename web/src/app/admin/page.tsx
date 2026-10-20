import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { ButtonLink } from "@/components/ui/button";
import { DisplayTitle } from "@/components/ui/typography";

export const metadata: Metadata = {
  title: "Admin",
};

// The admin entry point, for the team. Sign-in only: admin accounts are never self-made
// (`bin/rails admin:grant`). Signed in, the card sends the admin on to the console's first
// tab, the booking requests (RAA-142).
export default function AdminHome() {
  return (
    <main className="mx-auto grid w-full max-w-page flex-1 gap-block px-gutter py-page-pad md:grid-cols-[1fr_20rem]">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <DisplayTitle>Admin console</DisplayTitle>
          <ButtonLink href="/admin/ui-kit" variant="soft" size="sm">
            UI kit
          </ButtonLink>
        </div>
        <p className="max-w-lede text-muted">
          For the team: answer travellers&apos; booking requests on partners&apos; behalf.
        </p>
      </div>
      <AuthCard role="admin" mode="signin" />
    </main>
  );
}
