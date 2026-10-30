"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/components/ui/cn";
import { MENU_DIVIDER, MENU_SURFACE } from "@/components/ui/menu";
import { useSession } from "@/lib/auth/session";
import { useMarkRead, useNotifications, type Notification } from "./use-notifications";

const RELATIVE = new Intl.RelativeTimeFormat("en", { numeric: "auto", style: "short" });

// "just now", "5 min. ago", "3 hr. ago", "yesterday", then the date.
function when(iso: string) {
  const seconds = (Date.now() - new Date(iso).getTime()) / 1000;
  if (seconds < 60) return "just now";
  if (seconds < 3600) return RELATIVE.format(-Math.floor(seconds / 60), "minute");
  if (seconds < 86400) return RELATIVE.format(-Math.floor(seconds / 3600), "hour");
  if (seconds < 7 * 86400) return RELATIVE.format(-Math.floor(seconds / 86400), "day");
  return new Date(iso).toLocaleDateString("en-PH", { month: "short", day: "numeric" });
}

// The header's bell, for signed-in guests and partners: how many notifications are unread, and
// a list of them (newest first) whose rows open the page each is about and mark it read. A
// plain disclosure like AccountMenu: it closes on Escape, a click outside and a page change.
// On a phone the list spans the window under the header.
export function NotificationBell() {
  const session = useSession();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const signedIn = session?.user.role === "guest" || session?.user.role === "partner";
  const query = useNotifications(signedIn);
  const markRead = useMarkRead();

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

  if (!signedIn) return null;
  const count = query.unreadCount;

  function onOpen(notification: Notification) {
    if (!notification.read) markRead.mutate(notification.id);
    setOpen(false);
  }

  return (
    <div ref={root} className="flex sm:relative">
      <button
        ref={trigger}
        type="button"
        data-testid="nav-notifications"
        aria-expanded={open}
        aria-controls="notifications-panel"
        aria-label={count === 0 ? "Notifications" : `Notifications, ${count} unread`}
        onClick={() => setOpen(!open)}
        className={cn(
          "relative flex size-11 items-center justify-center rounded-full border border-glass-edge text-white transition-colors duration-300 ease-calm",
          open ? "bg-glass-hover" : "bg-glass-fill hover:bg-glass-hover",
        )}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5">
          <path
            d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15L6 16Zm4 4a2 2 0 0 0 4 0"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>
        {count > 0 && (
          <span
            data-testid="nav-notifications-count"
            className="absolute -right-1 -top-1 min-w-5 rounded-full bg-danger px-1 text-center text-xs font-bold leading-5 text-white"
          >
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>
      {open && (
        <div
          id="notifications-panel"
          data-testid="notifications-panel"
          className={cn(
            MENU_SURFACE,
            "absolute top-full z-20 mt-2 flex animate-drop-in flex-col text-foreground",
            // A phone: the header's width; from sm: a card under the bell.
            "inset-x-0 max-h-[70vh] sm:right-0 sm:left-auto sm:w-96",
          )}
        >
          <div className="flex items-center justify-between gap-3 px-3 pt-1 pb-2">
            <h2 className="font-semibold">Notifications</h2>
            {count > 0 && (
              <button
                type="button"
                data-testid="notifications-read-all"
                onClick={() => markRead.mutate("all")}
                className="tap-target text-sm font-semibold text-primary hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>
          <div className={MENU_DIVIDER} role="separator" />
          <div className="-mx-2 overflow-y-auto px-2">
            {query.isPending ? (
              <p className="px-3 py-4 text-sm text-muted">Loading…</p>
            ) : query.isError ? (
              <p role="alert" className="px-3 py-4 text-sm text-danger">
                Notifications couldn&apos;t load. Try again in a moment.
              </p>
            ) : query.notifications.length === 0 ? (
              <p data-testid="notifications-empty" className="px-3 py-4 text-sm text-muted">
                Nothing yet. Requests, answers and payments show up here.
              </p>
            ) : (
              <ul className="flex flex-col">
                {query.notifications.map((notification) => (
                  <li key={notification.id}>
                    <Link
                      href={notification.path}
                      onClick={() => onOpen(notification)}
                      data-testid="notification-row"
                      data-read={notification.read}
                      className="flex gap-3 rounded-control px-3 py-2.5 transition-colors duration-300 ease-calm hover:bg-mist focus-visible:bg-mist"
                    >
                      <span
                        aria-hidden
                        className={cn("mt-2 size-2 shrink-0 rounded-full", notification.read ? "bg-transparent" : "bg-primary")}
                      />
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className={cn("text-sm", notification.read ? "font-medium text-muted" : "font-semibold")}>
                          {!notification.read && <span className="sr-only">Unread: </span>}
                          {notification.title}
                        </span>
                        <span className="text-sm font-normal text-muted">{notification.body}</span>
                        <span className="text-xs font-normal text-muted">{when(notification.created_at)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {query.hasNextPage && (
              <button
                type="button"
                onClick={() => void query.fetchNextPage()}
                disabled={query.isFetchingNextPage}
                className="tap-target my-1 w-full rounded-control px-3 py-2 text-sm font-semibold text-primary hover:bg-mist"
              >
                {query.isFetchingNextPage ? "Loading…" : "Show older"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
