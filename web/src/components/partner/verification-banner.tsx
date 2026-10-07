"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePartnerProfile } from "./use-partner-profile";
import { isVerified, usePartnerVerification } from "./use-partner-verification";

// Under the partner header until the partner's ID is verified (RAA-45); not on the verify
// page itself, and not while the profile banner shows, so there is one banner at a time.
export function VerificationBanner() {
  const pathname = usePathname();
  const { data: profile } = usePartnerProfile();
  const { data } = usePartnerVerification();
  if (!data || isVerified(data) || !profile?.complete || pathname === "/partner/verify") return null;

  return (
    <div data-testid="verification-banner" role="status" className="border-b border-warning/30 bg-warning/10">
      <p className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-2 gap-y-1 px-4 py-3 text-sm">
        <span>
          {data.status === "in_review"
            ? "Your ID is being reviewed. You can add listings once it's approved."
            : "Verify your ID before you add a listing."}
        </span>
        <Link
          href="/partner/verify"
          data-testid="verification-banner-link"
          className="font-semibold text-link underline underline-offset-4"
        >
          {data.status === "in_review" ? "See status" : "Verify your ID"}
        </Link>
      </p>
    </div>
  );
}
