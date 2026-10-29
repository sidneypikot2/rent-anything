"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertGlyph } from "@/components/discovery/tag-glyphs";
import { useSession } from "@/lib/auth/session";
import { useGuestProfile } from "./use-guest-profile";

// Under the header on the guest's dashboard until the profile is complete. Not on the cart
// or trips, where they plan: checkout asks for what partners need and never waits on the
// address. Not for a guest without an account (RAA-177).
export function GuestProfileBanner() {
  const pathname = usePathname();
  const registered = useSession()?.user.registered;
  const { data } = useGuestProfile();
  if (!registered || !data || data.complete || pathname !== "/dashboard") return null;

  // Over the photo backdrop, so light text on a warm glass strip. A phone gets one short line
  // (RAA-161); from sm the whole sentence.
  return (
    <div data-testid="guest-profile-banner" role="status" className="border-b border-warning-tint/30 bg-warning/25 text-white">
      <p className="mx-auto flex w-full max-w-page items-center gap-2 px-4 py-2 text-sm sm:flex-wrap sm:gap-x-2 sm:gap-y-1 sm:px-gutter sm:py-3">
        <AlertGlyph className="size-4 shrink-0 text-warning-tint" />
        <span className="min-w-0 flex-1 truncate sm:flex-none sm:whitespace-normal">
          <span className="sm:hidden">Complete your profile to book</span>
          <span className="max-sm:hidden">
            Your profile isn&apos;t complete. Add your legal name, phone and address before you book.
          </span>
        </span>
        <Link
          href="/profile"
          data-testid="guest-profile-banner-link"
          className="shrink-0 font-semibold text-sky-pale underline underline-offset-4"
        >
          <span className="sm:hidden">Add details</span>
          <span className="max-sm:hidden">Complete your profile</span>
        </Link>
      </p>
    </div>
  );
}
