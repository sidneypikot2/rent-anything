"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth/actions";
import { useSession } from "@/lib/auth/session";
import type { Section } from "@/components/landing/section-header";

const LOGIN_PATHS: Partial<Record<Section, string>> = { guest: "/login", partner: "/partner/login" };

// The header's account links: "Sign in" for the section's login page, or the signed-in
// user's name and "Sign out".
export function AccountNav({ section }: { section: Section }) {
  const router = useRouter();
  const session = useSession();
  if (session === undefined) return null;

  if (session === null) {
    const loginPath = LOGIN_PATHS[section];
    return loginPath ? (
      <Link href={loginPath} data-testid="nav-signin">
        Sign in
      </Link>
    ) : null;
  }

  async function onSignOut() {
    await signOut();
    router.replace(LOGIN_PATHS[section] ?? "/");
  }

  return (
    <span className="flex items-center gap-3">
      <span data-testid="nav-user" className="text-white">
        {session.user.name}
      </span>
      <button type="button" onClick={onSignOut} className="hover:text-white">
        Sign out
      </button>
    </span>
  );
}
