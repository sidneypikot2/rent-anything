"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ComponentType } from "react";
import {
  BagGlyph,
  ChevronGlyph,
  CogGlyph,
  PersonGlyph,
  PlusGlyph,
  SignOutGlyph,
  SuitcaseGlyph,
} from "@/components/discovery/tag-glyphs";
import { cn } from "@/components/ui/cn";
import { MENU_DANGER, MENU_DIVIDER, MENU_ICON, MENU_PANEL, MENU_ROW } from "@/components/ui/menu";
import { signOut } from "@/lib/auth/actions";
import { LOGIN_PATHS } from "@/lib/auth/paths";
import { useSession, type Session } from "@/lib/auth/session";

type MenuSection = "guest" | "partner";
type MenuLink = { href: string; label: string; testId: string; icon: ComponentType<{ className?: string }> };

const LINKS: Record<MenuSection, MenuLink[]> = {
  guest: [
    { href: "/trips", label: "Booked trips", testId: "nav-menu-trips", icon: SuitcaseGlyph },
    { href: "/profile", label: "Profile", testId: "nav-menu-profile", icon: PersonGlyph },
    { href: "/settings", label: "Settings", testId: "nav-menu-settings", icon: CogGlyph },
  ],
  partner: [
    { href: "/partner/profile", label: "Profile", testId: "nav-menu-profile", icon: PersonGlyph },
    { href: "/partner/businesses/new", label: "Add business", testId: "nav-menu-add-business", icon: PlusGlyph },
    { href: "/partner/settings", label: "Settings", testId: "nav-menu-settings", icon: CogGlyph },
  ],
};

// A guest without a password (RAA-179: they checked out, or opened a trip link) has no account
// settings yet, and is offered to keep their trips instead.
function linksFor(section: MenuSection, session: Session): MenuLink[] {
  if (section !== "guest" || session.user.registered) return LINKS[section];
  return [
    ...LINKS.guest.filter(({ href }) => href !== "/settings"),
    { href: "/trips/keep", label: "Keep your trips", testId: "nav-menu-keep-trips", icon: BagGlyph },
  ];
}

// Its rows are the ⋯ menu's (MENU_ROW in menu.tsx), so every dropdown looks the same.
const LINK = cn(MENU_ROW, "text-foreground");

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
  const name = session.user.name ?? session.user.email ?? "Guest";
  const initial = name.trim().charAt(0).toUpperCase() || "G";
  // The email under the name, when there is a name to put it under.
  const email = session.user.name ? session.user.email : null;

  // A trip link's session lives in this tab only: closing it ends it, and coming back takes the
  // link and PIN again, so it goes home rather than to a sign-in they have no password for.
  const tripLink = section === "guest" && session.tabOnly;

  async function onSignOut() {
    setOpen(false);
    await signOut();
    router.replace(tripLink ? "/" : LOGIN_PATHS[section]);
  }

  return (
    // A glass pill in the header; the menu opens as a card beneath it.
    <div ref={root} className="relative flex">
      <button
        ref={trigger}
        type="button"
        data-testid="nav-user"
        // The first letter, drawn by CSS on a phone, so the button's text stays the name.
        data-initial={initial}
        aria-expanded={open}
        aria-controls="account-menu"
        onClick={() => setOpen(!open)}
        className={cn(
          // On a phone (max-sm) the name shrinks to its first letter, so the header keeps to one
          // row beside the logo and the cart: an email beside them wrapped it onto two.
          // From sm: the initial in a pale disc, the name and a chevron, staying glass while open
          // (a brighter fill), as the cart beside it does.
          "relative flex min-h-11 items-center gap-2 rounded-full border border-glass-edge py-1 pr-3 pl-1 font-semibold text-white transition-colors duration-300 ease-calm max-sm:w-11 max-sm:justify-center max-sm:p-0 max-sm:before:content-[attr(data-initial)_/_'']",
          open ? "bg-glass-hover" : "bg-glass-fill hover:bg-glass-hover",
        )}
      >
        {/* Drawn by CSS, so the button's text stays the name alone. */}
        <span
          aria-hidden
          data-initial={initial}
          className="grid size-8 place-items-center rounded-full bg-sky-pale text-sm text-navy before:content-[attr(data-initial)] max-sm:hidden"
        />
        <span className="max-w-48 truncate max-sm:sr-only">{name}</span>
        <ChevronGlyph
          direction={open ? "up" : "down"}
          className="size-4 text-sky-mist transition-transform duration-300 ease-calm max-sm:hidden"
        />
      </button>
      {open && (
        <ul
          id="account-menu"
          data-testid="nav-user-menu"
          className={cn(MENU_PANEL, "absolute top-full right-0 z-20 mt-2 animate-drop-in overflow-hidden")}
        >
          {/* Who is signed in, so the menu says whose account it opens. */}
          <li className="flex items-center gap-3 px-3 pt-2 pb-3">
            <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-sky-pale font-bold text-navy">
              {initial}
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-semibold text-foreground">{name}</span>
              {email && <span className="truncate text-sm text-muted">{email}</span>}
            </span>
          </li>
          <li className={MENU_DIVIDER} role="separator" />
          {linksFor(section, session).map(({ href, label, testId, icon: Icon }) => (
            <li key={href}>
              <Link href={href} data-testid={testId} className={LINK}>
                <Icon className={cn(MENU_ICON, "text-primary")} />
                {label}
              </Link>
            </li>
          ))}
          <li className={MENU_DIVIDER} role="separator" />
          <li>
            {/* Last, under a divider, in red: as the ⋯ menu's Remove. */}
            <button type="button" data-testid="nav-menu-signout" onClick={onSignOut} className={cn(MENU_ROW, MENU_DANGER)}>
              <SignOutGlyph className={MENU_ICON} />
              {tripLink ? "Close trips" : "Sign out"}
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}
