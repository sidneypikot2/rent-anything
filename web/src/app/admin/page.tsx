import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { PlaceholderBlock } from "@/components/landing/placeholder-block";
import { ButtonLink } from "@/components/ui/button";
import { DisplayTitle } from "@/components/ui/typography";

export const metadata: Metadata = {
  title: "Admin · Rent-Anything",
};

const PANELS = [
  { title: "Partner verification", note: "ID checks waiting for review" },
  { title: "Listing approvals", note: "New and changed listings" },
  { title: "Disputes", note: "Open damage and cancellation disputes" },
  { title: "Commission", note: "Rate per category" },
];

// The admin entry point, for the team. Sign-in only: admin accounts are never self-made.
export default function AdminHome() {
  return (
    <main className="mx-auto grid w-full max-w-5xl flex-1 gap-10 px-4 py-12 md:grid-cols-[1fr_20rem]">
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <DisplayTitle>Admin console</DisplayTitle>
          <ButtonLink href="/admin/ui-kit" variant="soft" size="sm">
            UI kit
          </ButtonLink>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {PANELS.map((panel) => (
            <PlaceholderBlock key={panel.title} {...panel} />
          ))}
        </div>
      </div>
      <AuthCard role="admin" mode="signin" />
    </main>
  );
}
