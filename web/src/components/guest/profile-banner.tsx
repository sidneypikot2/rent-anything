"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useGuestProfile } from "./use-guest-profile";

// Under the header on every signed-in guest page until the profile is complete; not on
// the profile page itself, which is where it leads.
export function GuestProfileBanner() {
  const pathname = usePathname();
  const { data } = useGuestProfile();
  if (!data || data.complete || pathname === "/profile") return null;

  return (
    <div data-testid="guest-profile-banner" role="status" className="border-b border-warning/30 bg-warning/10">
      <p className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-2 gap-y-1 px-4 py-3 text-sm">
        <span>Your profile isn&apos;t complete. Add your legal name, phone and address before you book.</span>
        <Link
          href="/profile"
          data-testid="guest-profile-banner-link"
          className="font-semibold text-link underline underline-offset-4"
        >
          Complete your profile
        </Link>
      </p>
    </div>
  );
}
