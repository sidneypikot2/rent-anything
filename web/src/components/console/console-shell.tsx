"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { MoreGlyph, SignOutGlyph } from "@/components/discovery/tag-glyphs";
import { cn } from "@/components/ui/cn";
import { Dialog } from "@/components/ui/dialog";
import { MENU_DANGER, MENU_DIVIDER, MENU_ICON, MENU_ROW } from "@/components/ui/menu";
import { signOut } from "@/lib/auth/actions";
import { LOGIN_PATHS } from "@/lib/auth/paths";

export type ConsoleRole = "partner" | "admin";

export type ConsoleTab = {
  id: string;
  href: string;
  label: string;
  // A shorter label for the phone's bar, where a long one wraps.
  barLabel?: string;
  icon: ReactNode;
  // Other paths that count as this tab.
  also?: string[];
  // How many are waiting on this tab (requests to answer); none shows nothing.
  count?: number;
  // On a phone's bar rather than under More.
  onBar?: boolean;
};

export const CONSOLE_ICON = "size-5 shrink-0";

function isCurrent(tab: ConsoleTab, pathname: string) {
  return [tab.href, ...(tab.also ?? [])].some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function useSignOut(role: ConsoleRole) {
  const router = useRouter();
  return async () => {
    await signOut();
    router.replace(LOGIN_PATHS[role]);
  };
}

function CountBadge({ count, className }: { count?: number; className?: string }) {
  if (!count) return null;
  return (
    <span className={cn("flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-small font-semibold text-white", className)}>
      {count}
      <span className="sr-only"> waiting</span>
    </span>
  );
}

const ARIA_LABELS: Record<ConsoleRole, string> = { partner: "Partner", admin: "Admin" };

// A rail of icons that opens on hover, or on keyboard focus, taking its room from the page beside
// it rather than floating over it. Only :focus-visible counts: a clicked link keeps focus and
// would hold it open. Labels are only faded, so a screen reader always has them. It moves the
// whole page, so it goes slowly, easing in and out, after a pause that lets a pointer cross it
// without setting it off, and not at all under reduced motion.
function Sidebar({ role, tabs }: { role: ConsoleRole; tabs: ConsoleTab[] }) {
  const pathname = usePathname();
  const onSignOut = useSignOut(role);
  const label = "truncate whitespace-nowrap opacity-0 transition-opacity delay-300 duration-700 ease-soft group-hover:opacity-100 group-hover:delay-150 group-has-focus-visible:opacity-100";
  const row = "relative flex min-h-11 w-full items-center gap-3 rounded-control px-3 text-sm font-medium transition-colors duration-300 ease-calm";

  return (
    <nav
      aria-label={ARIA_LABELS[role]}
      data-testid={`${role}-sidebar`}
      className="group sticky top-(--chrome) hidden max-h-[calc(100dvh-var(--chrome))] w-11 shrink-0 flex-col gap-1 self-start overflow-x-hidden overflow-y-auto py-page-pad transition-[width] delay-300 duration-700 ease-soft hover:w-44 hover:delay-150 has-focus-visible:w-44 has-focus-visible:delay-0 motion-reduce:transition-none md:flex"
    >
      <ul className="flex flex-col gap-1">
        {tabs.map((tab) => {
          const current = isCurrent(tab, pathname);
          return (
            <li key={tab.id}>
              <Link
                href={tab.href}
                data-testid={`${role}-nav-${tab.id}`}
                aria-current={current ? "page" : undefined}
                className={cn(row, current ? "bg-sky-mist font-semibold text-primary" : "text-muted hover:bg-mist hover:text-foreground")}
              >
                {tab.icon}
                <span className={label}>{tab.label}</span>
                <CountBadge count={tab.count} className="absolute top-0 left-6" />
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="mt-1 border-t border-line pt-1">
        <button type="button" onClick={onSignOut} data-testid={`${role}-nav-signout`} className={cn(row, "cursor-pointer", MENU_DANGER)}>
          <SignOutGlyph className={CONSOLE_ICON} />
          <span className={label}>Sign out</span>
        </button>
      </div>
    </nav>
  );
}

// A phone's tabs along the window's foot (`--bottom-bar` in globals.css keeps the page and what
// sticks to its foot clear of it), with the rest, and signing out, under More. With every tab on
// the bar (the admin console) there is no More: the header's Sign out is the way out.
function BottomBar({ role, tabs }: { role: ConsoleRole; tabs: ConsoleTab[] }) {
  const pathname = usePathname();
  const onSignOut = useSignOut(role);
  const [moreOpen, setMoreOpen] = useState(false);
  const barTabs = tabs.filter((tab) => tab.onBar);
  const moreTabs = tabs.filter((tab) => !tab.onBar);
  const moreCurrent = moreTabs.some((tab) => isCurrent(tab, pathname));
  const item = "relative flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-control py-1 text-small font-medium";

  return (
    <>
      <nav
        aria-label={ARIA_LABELS[role]}
        data-console-bar
        data-testid={`${role}-bar`}
        className="fixed inset-x-0 bottom-0 z-40 flex items-stretch gap-1 border-t border-line bg-surface px-2 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] text-muted shadow-float md:hidden"
      >
        {barTabs.map((tab) => {
          const current = isCurrent(tab, pathname);
          return (
            <Link
              key={tab.id}
              href={tab.href}
              data-testid={`${role}-bar-${tab.id}`}
              aria-current={current ? "page" : undefined}
              className={cn(item, current && "font-semibold text-primary")}
            >
              {tab.icon}
              {tab.barLabel ?? tab.label}
              <CountBadge count={tab.count} className="absolute top-0 left-1/2 ml-1" />
            </Link>
          );
        })}
        {moreTabs.length > 0 && (
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            data-testid={`${role}-bar-more`}
            aria-haspopup="dialog"
            className={cn(item, "cursor-pointer", moreCurrent && "font-semibold text-primary")}
          >
            <MoreGlyph className={CONSOLE_ICON} />
            More
          </button>
        )}
      </nav>
      <Dialog open={moreOpen} onClose={() => setMoreOpen(false)} title="More" placement="sheet" data-testid={`${role}-more`}>
        <ul className="flex flex-col text-base font-medium">
          {moreTabs.map((tab) => (
            <li key={tab.id}>
              <Link
                href={tab.href}
                onClick={() => setMoreOpen(false)}
                data-testid={`${role}-more-${tab.id}`}
                aria-current={isCurrent(tab, pathname) ? "page" : undefined}
                className={cn(MENU_ROW, "min-h-11")}
              >
                <span aria-hidden className={cn(MENU_ICON, "flex items-center justify-center text-primary")}>
                  {tab.icon}
                </span>
                {tab.label}
              </Link>
            </li>
          ))}
          <li aria-hidden className={MENU_DIVIDER} />
          <li>
            <button type="button" onClick={onSignOut} data-testid={`${role}-more-signout`} className={cn(MENU_ROW, MENU_DANGER, "min-h-11 w-full")}>
              <span aria-hidden className={cn(MENU_ICON, "flex items-center justify-center")}>
                <SignOutGlyph className={CONSOLE_ICON} />
              </span>
              Sign out
            </button>
          </li>
        </ul>
      </Dialog>
    </>
  );
}

// A signed-in partner's or admin's pages (RAA-267, RAA-289): tabs in a rail of icons from `md`,
// along the window's foot on a phone, beside the page. Test ids are prefixed with the role:
// `<role>-nav-*` (rail), `<role>-bar-*` (phone bar) and `<role>-more-*` (its sheet).
export function ConsoleShell({ role, tabs, children }: { role: ConsoleRole; tabs: ConsoleTab[]; children: ReactNode }) {
  return (
    <div className="flex flex-1 gap-3 lg:gap-6">
      <Sidebar role={role} tabs={tabs} />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      <BottomBar role={role} tabs={tabs} />
    </div>
  );
}
