"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AccountMenu } from "@/components/auth/account-menu";
import { signOut } from "@/lib/auth/actions";
import { DASHBOARD_PATHS, LOGIN_PATHS, REGISTER_PATHS } from "@/lib/auth/paths";
import { useSession } from "@/lib/auth/session";
import type { Section } from "@/components/landing/section-header";

// The header's account links. Signed in, guests and partners get their account menu
// (guests also Trips; Profile, Settings, Sign out) and admins their name and "Sign out". Signed out,
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
      <span className="flex items-center gap-1 rounded-full border border-white/15 bg-white/10 p-1">
        <Link
          href={LOGIN_PATHS.guest}
          data-testid="nav-signin"
          className="flex min-h-9 items-center rounded-full px-3 whitespace-nowrap hover:bg-white/15 hover:text-white sm:px-4"
        >
          Sign in
        </Link>
        <Link
          href={REGISTER_PATHS.guest}
          data-testid="nav-register"
          className="flex min-h-9 items-center rounded-full bg-white px-3 font-bold whitespace-nowrap text-navy hover:bg-sky-mist sm:px-4"
        >
          {/* Short on a phone, so the bar stays one row. */}
          <span className="sm:hidden">Sign up</span>
          <span className="hidden sm:inline">Create an account</span>
        </Link>
      </span>
    ) : null;
  }

  if (section !== "admin") return <AccountMenu section={section} />;

  async function onSignOut() {
    await signOut();
    router.replace(LOGIN_PATHS[section]);
  }

  return (
    <span className="flex items-center gap-1 rounded-full border border-white/15 bg-white/10 p-1">
      <Link
        href={DASHBOARD_PATHS[session.user.role]}
        data-testid="nav-user"
        className="flex min-h-9 items-center rounded-full px-4 text-white hover:bg-white/15"
      >
        {session.user.name ?? session.user.email}
      </Link>
      <button type="button" onClick={onSignOut} className="flex min-h-9 items-center rounded-full px-4 hover:bg-white/15 hover:text-white">
        Sign out
      </button>
    </span>
  );
}
