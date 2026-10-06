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
    <ul className="flex items-center gap-4">
      {LINKS.map(({ href, label, testId }) => {
        const current = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <li key={href}>
            <Link
              href={href}
              data-testid={testId}
              aria-current={current ? "page" : undefined}
              className={cn(current && "text-white underline decoration-aqua decoration-2 underline-offset-8")}
            >
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
