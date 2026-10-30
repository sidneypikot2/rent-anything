"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AccountMenu } from "@/components/auth/account-menu";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { signOut } from "@/lib/auth/actions";
import { DASHBOARD_PATHS, LOGIN_PATHS, REGISTER_PATHS } from "@/lib/auth/paths";
import { isAnonymous, useSession } from "@/lib/auth/session";
import type { Section } from "@/components/landing/section-header";

// The header's account links. Signed in, guests and partners get their account menu
// (guests also Trips; Profile, Settings, Sign out) beside the notifications bell, and admins their name and "Sign out". Signed out,
// "Sign in" and "Sign up" show in the guest section only (partner and admin
// pages show their own form), and not on /login or /register, where the card already is
// that form. A guest with no account yet (RAA-177, made by their first add) gets the
// signed-out links; the cart shows their trips.
export function AccountNav({ section }: { section: Section }) {
  const router = useRouter();
  const pathname = usePathname();
  const session = useSession();
  if (session === undefined) return null;

  if (session === null || isAnonymous(session)) {
    const onAuthPage = pathname.startsWith(LOGIN_PATHS.guest) || pathname === REGISTER_PATHS.guest;
    return section === "guest" && !onAuthPage ? (
      <span className="flex items-center gap-1 rounded-full border border-glass-edge bg-glass-fill p-1">
        <Link
          href={LOGIN_PATHS.guest}
          data-testid="nav-signin"
          className="tap-target flex min-h-9 items-center rounded-full px-3 whitespace-nowrap hover:bg-glass-hover hover:text-white sm:px-4"
        >
          Sign in
        </Link>
        <Link
          href={REGISTER_PATHS.guest}
          data-testid="nav-register"
          // Lit glass rather than a white pill: brighter than Sign in, but not the brightest thing
          // on a page whose main action is its blue button.
          className="tap-target flex min-h-9 items-center rounded-full bg-glass-hover px-3 font-bold whitespace-nowrap text-white hover:text-sky-pale sm:px-4"
        >
          Sign up
        </Link>
      </span>
    ) : null;
  }

  if (section !== "admin") {
    return (
      <>
        <NotificationBell />
        <AccountMenu section={section} />
      </>
    );
  }

  async function onSignOut() {
    await signOut();
    router.replace(LOGIN_PATHS[section]);
  }

  return (
    <span className="flex items-center gap-1 rounded-full border border-glass-edge bg-glass-fill p-1">
      <Link
        href={DASHBOARD_PATHS[session.user.role]}
        data-testid="nav-user"
        className="tap-target flex min-h-9 items-center rounded-full px-4 text-white hover:bg-glass-hover"
      >
        {session.user.name ?? session.user.email}
      </Link>
      <button type="button" onClick={onSignOut} className="tap-target flex min-h-9 items-center rounded-full px-4 hover:bg-glass-hover hover:text-white">
        Sign out
      </button>
    </span>
  );
}
