"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ButtonLink } from "@/components/ui/button";
import { signOut } from "@/lib/auth/actions";
import { DASHBOARD_PATHS, LOGIN_PATHS, REGISTER_PATHS } from "@/lib/auth/paths";
import { useSession } from "@/lib/auth/session";
import type { Section } from "@/components/landing/section-header";

// The header's account links: the signed-in user's name (to their dashboard) and
// "Sign out", or, signed out, "Sign in" and "Create an account" in the guest section
// only (partner and admin pages show their own form).
export function AccountNav({ section }: { section: Section }) {
  const router = useRouter();
  const session = useSession();
  if (session === undefined) return null;

  if (session === null) {
    return section === "guest" ? (
      <span className="flex items-center gap-4">
        <Link href={LOGIN_PATHS.guest} data-testid="nav-signin">
          Sign in
        </Link>
        <ButtonLink
          href={REGISTER_PATHS.guest}
          variant="accent"
          size="sm"
          data-testid="nav-register"
        >
          Create an account
        </ButtonLink>
      </span>
    ) : null;
  }

  async function onSignOut() {
    await signOut();
    router.replace(LOGIN_PATHS[section]);
  }

  return (
    <span className="flex items-center gap-3">
      <Link href={DASHBOARD_PATHS[session.user.role]} data-testid="nav-user" className="text-white">
        {session.user.name}
      </Link>
      <button type="button" onClick={onSignOut} className="hover:text-white">
        Sign out
      </button>
    </span>
  );
}
