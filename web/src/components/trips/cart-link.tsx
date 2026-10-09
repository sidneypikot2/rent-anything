"use client";

import Link from "next/link";
import { useSession } from "@/lib/auth/session";
import { cartItemCount, useTrips } from "./use-trips";

// The header's cart, for signed-in guests: a bag with the number of items in the trips
// they're still planning (not the number of trips).
export function CartLink() {
  const session = useSession();
  const isGuest = session?.user.role === "guest";
  const trips = useTrips(isGuest);
  if (!isGuest) return null;

  const count = cartItemCount(trips.data);
  return (
    <Link
      href="/cart"
      data-testid="nav-cart"
      aria-label={count === 1 ? "Cart, 1 item" : `Cart, ${count} items`}
      className="relative flex items-center p-1 text-white hover:text-aqua"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6">
        <path
          d="M6 8h12l-1 12H7L6 8Zm3 0V6a3 3 0 0 1 6 0v2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinejoin="round"
        />
      </svg>
      {count > 0 && (
        <span
          data-testid="nav-cart-count"
          className="absolute -right-1.5 -top-1 min-w-5 rounded-full bg-aqua px-1 text-center text-xs font-bold leading-5 text-navy"
        >
          {count}
        </span>
      )}
    </Link>
  );
}
