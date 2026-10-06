"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { signOut } from "@/lib/auth/actions";
import { LOGIN_PATHS } from "@/lib/auth/paths";
import { useSession } from "@/lib/auth/session";

type MenuSection = "guest" | "partner";

const LINKS: Record<MenuSection, { href: string; label: string; testId: string }[]> = {
  guest: [
    { href: "/profile", label: "Profile", testId: "nav-menu-profile" },
    { href: "/settings", label: "Settings", testId: "nav-menu-settings" },
  ],
  partner: [
    { href: "/partner/profile", label: "Profile", testId: "nav-menu-profile" },
    { href: "/partner/settings", label: "Settings", testId: "nav-menu-settings" },
  ],
};

const ITEM = "block w-full rounded-lg px-3 py-2 text-left text-foreground hover:bg-surface-2";

// The signed-in user's name in the header, opening their account links and Sign out.
// A plain disclosure (button + list), not an ARIA menu widget: it closes on Escape, on a
// click outside it and when the page changes.
export function AccountMenu({ section }: { section: MenuSection }) {
  const router = useRouter();
  const pathname = usePathname();
  const session = useSession();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  // Following a link closes the menu.
  const [shownPath, setShownPath] = useState(pathname);
  if (shownPath !== pathname) {
    setShownPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      trigger.current?.focus();
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!session) return null;

  async function onSignOut() {
    setOpen(false);
    await signOut();
    router.replace(LOGIN_PATHS[section]);
  }

  return (
    <div ref={root} className="relative">
      <button
        ref={trigger}
        type="button"
        data-testid="nav-user"
        aria-expanded={open}
        aria-controls="account-menu"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-white"
      >
        {session.user.name ?? session.user.email}
        <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4 fill-current">
          <path d="M5.5 7.5 10 12l4.5-4.5" fill="none" stroke="currentColor" strokeWidth="1.75" />
        </svg>
      </button>
      {open && (
        <ul
          id="account-menu"
          data-testid="nav-user-menu"
          className="absolute right-0 top-full z-20 mt-2 w-48 rounded-2xl border-[1.5px] border-line bg-surface p-2 shadow-xl shadow-primary/10"
        >
          {LINKS[section].map(({ href, label, testId }) => (
            <li key={href}>
              <Link href={href} data-testid={testId} className={ITEM}>
                {label}
              </Link>
            </li>
          ))}
          <li className="my-1 border-t border-line" role="separator" />
          <li>
            <button type="button" data-testid="nav-menu-signout" onClick={onSignOut} className={ITEM}>
              Sign out
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}
