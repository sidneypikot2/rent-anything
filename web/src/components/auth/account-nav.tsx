"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AccountMenu } from "@/components/auth/account-menu";
import { ButtonLink } from "@/components/ui/button";
import { signOut } from "@/lib/auth/actions";
import { DASHBOARD_PATHS, LOGIN_PATHS, REGISTER_PATHS } from "@/lib/auth/paths";
import { useSession } from "@/lib/auth/session";
import type { Section } from "@/components/landing/section-header";

// The header's account links. Signed in, guests and partners get their account menu
// (Profile, Settings, Sign out) and admins their name and "Sign out". Signed out,
// "Sign in" and "Create an account" show in the guest section only (partner and admin
// pages show their own form), and not on /login or /register, where the card already is
// that form.
export function AccountNav({ section }: { section: Section }) {
  const router = useRouter();
  const pathname = usePathname();
  const session = useSession();
  if (session === undefined) return null;

  if (session === null) {
    const onAuthPage = pathname === LOGIN_PATHS.guest || pathname === REGISTER_PATHS.guest;
    return section === "guest" && !onAuthPage ? (
      <span className="flex items-center gap-4">
        <Link href={LOGIN_PATHS.guest} data-testid="nav-signin" className="hover:text-white">
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

  if (section !== "admin") return <AccountMenu section={section} />;

  async function onSignOut() {
    await signOut();
    router.replace(LOGIN_PATHS[section]);
  }

  return (
    <span className="flex items-center gap-3">
      <Link href={DASHBOARD_PATHS[session.user.role]} data-testid="nav-user" className="text-white">
        {session.user.name ?? session.user.email}
      </Link>
      <button type="button" onClick={onSignOut} className="hover:text-white">
        Sign out
      </button>
    </span>
  );
}
