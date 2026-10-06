"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePartnerProfile } from "./use-partner-profile";

// Under the partner header on every partner page until the profile is complete; not on
// the profile page itself, which is where it leads.
export function ProfileBanner() {
  const pathname = usePathname();
  const { data } = usePartnerProfile();
  if (!data || data.complete || pathname === "/partner/profile") return null;

  return (
    <div data-testid="profile-banner" role="status" className="border-b border-warning/30 bg-warning/10">
      <p className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-2 gap-y-1 px-4 py-3 text-sm">
        <span>Your profile isn&apos;t complete. Add your legal name, phone and business address before you list.</span>
        <Link
          href="/partner/profile"
          data-testid="profile-banner-link"
          className="font-semibold text-link underline underline-offset-4"
        >
          Complete your profile
        </Link>
      </p>
    </div>
  );
}
