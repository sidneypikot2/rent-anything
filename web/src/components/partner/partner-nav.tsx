"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui/cn";
import { useSession } from "@/lib/auth/session";

const LINKS = [
  { href: "/partner/dashboard", label: "Home", testId: "partner-nav-home" },
  { href: "/partner/listings", label: "Listings", testId: "partner-nav-listings" },
  { href: "/partner/calendar", label: "Calendar", testId: "partner-nav-calendar" },
  { href: "/partner/inbox", label: "Inbox", testId: "partner-nav-inbox" },
];

// The partner section's links, for a signed-in partner only: signed out, the partner
// pages are the sign-in and sign-up forms, which have nowhere else to go.
export function PartnerNav() {
  const pathname = usePathname();
  const session = useSession();
  if (session?.user.role !== "partner") return null;

  return (
    // A glass pill of links; on a phone it takes the header's second row and scrolls sideways.
    <ul className="order-last flex w-full items-center gap-1 overflow-x-auto rounded-full border border-white/15 bg-white/10 p-1 sm:order-none sm:w-auto">
      {LINKS.map(({ href, label, testId }) => {
        const current = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <li key={href}>
            <Link
              href={href}
              data-testid={testId}
              aria-current={current ? "page" : undefined}
              className={cn(
                "flex min-h-9 items-center whitespace-nowrap rounded-full px-4 hover:bg-white/15 hover:text-white",
                current && "bg-white/20 font-semibold text-white",
              )}
            >
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
