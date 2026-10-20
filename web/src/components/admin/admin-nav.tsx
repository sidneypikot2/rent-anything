"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui/cn";
import { useSession } from "@/lib/auth/session";

const LINKS = [{ href: "/admin/bookings", label: "Booking requests", testId: "admin-nav-bookings" }];

// The admin console's tabs (RAA-142), for a signed-in admin only: signed out, /admin is the
// sign-in form. Drawn like PartnerNav: a glass pill of links that takes the header's second
// row on a phone.
export function AdminNav() {
  const pathname = usePathname();
  const session = useSession();
  if (session?.user.role !== "admin") return null;

  return (
    <ul className="order-last flex w-full items-center gap-1 overflow-x-auto rounded-full border border-glass-edge bg-glass-fill p-1 sm:order-none sm:w-auto">
      {LINKS.map(({ href, label, testId }) => {
        const current = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <li key={href}>
            <Link
              href={href}
              data-testid={testId}
              aria-current={current ? "page" : undefined}
              className={cn(
                "flex min-h-9 items-center whitespace-nowrap rounded-full px-4 hover:bg-glass-hover hover:text-white",
                current && "bg-glass-hover font-semibold text-white",
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
