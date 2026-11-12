import { useSyncExternalStore } from "react";
import type { components } from "@/api/schema";

export type User = components["schemas"]["user"];
export type AuthTokens = components["schemas"]["auth_tokens"];
// accessToken: null until this tab has one (after a reload, the first API call refreshes it).
// cableToken: the WebSocket's token (RAA-304), from the same response, kept alongside it; null
// also when the API has no AnyCable to give one for.
// refreshToken: only a trip link's session, and a session from before the refresh cookie until
// its first refresh moves it into the cookie. tabOnly: a trip link's session (RAA-177), kept in
// this tab's sessionStorage only, so closing the tab ends it and the next open of the link asks
// for the PIN again.
export type Session = {
  accessToken: string | null;
  cableToken: string | null;
  refreshToken?: string;
  user: User;
  tabOnly?: boolean;
};

// The browser's own session (RAA-226): its refresh token is the API's HttpOnly `raa_refresh`
// cookie, which no script can read, the 15-minute access token lives only in this tab's memory,
// and localStorage keeps just the user, so every tab knows who is signed in. A trip link's
// session lives whole in this tab's sessionStorage instead (it never uses the cookie, which is
// the browser's), and while there is one it is the session. Storage can throw (private windows,
// blocked site data); then it is kept in memory and lasts until the page reloads.
const KEY = "raa.session";
const CHANGE_EVENT = "raa:session";

type Store = "local" | "tab";
const memory: Record<Store, string | null> = { local: null, tab: null };
let storageFailed = false;
// This tab's access and cable tokens for the browser's own session, and whose they are: another
// tab signing in as someone else changes the stored user, and these are then not theirs.
let access: { userId: number; token: string; cableToken: string | null } | null = null;

// What the web app sends to get, use or end the refresh cookie (RAA-306): the header asks for
// the cookie, and only a credentialed request sends and stores it. Never from a trip link's
// session.
export const REFRESH_COOKIE = {
  headers: { "X-Refresh-Cookie": "1" },
  credentials: "include",
} as const;

function storage(store: Store) {
  return store === "tab" ? window.sessionStorage : window.localStorage;
}

function readStore(store: Store): string | null {
  if (storageFailed) return memory[store];
  try {
    return storage(store).getItem(KEY);
  } catch {
    storageFailed = true;
    return memory[store];
  }
}

function writeStore(store: Store, value: string | null) {
  memory[store] = value;
  try {
    if (value === null) storage(store).removeItem(KEY);
    else storage(store).setItem(KEY, value);
  } catch {
    storageFailed = true;
  }
}

type Stored = { user: User; refreshToken?: string; accessToken?: string; cableToken?: string | null; tabOnly?: boolean };

function parse(raw: string | null): Stored | null {
  if (!raw) return null;
  try {
    const stored = JSON.parse(raw) as Stored;
    return stored?.user ? stored : null;
  } catch {
    return null;
  }
}

export function getSession(): Session | null {
  const tab = parse(readStore("tab"));
  if (tab) {
    return {
      accessToken: tab.accessToken ?? null,
      cableToken: tab.cableToken ?? null,
      refreshToken: tab.refreshToken,
      user: tab.user,
      tabOnly: true,
    };
  }

  const local = parse(readStore("local"));
  if (!local) {
    access = null;
    return null;
  }
  const own = access?.userId === local.user.id ? access : null;
  return {
    accessToken: own?.token ?? null,
    cableToken: own?.cableToken ?? null,
    // Only a session saved before the cookie (RAA-226) still has one here.
    ...(local.refreshToken && { refreshToken: local.refreshToken }),
    user: local.user,
  };
}

// A refresh keeps the session where it was: a trip link's stays in the tab. Any other
// sign-in ends a trip link's session in this tab.
export function saveSession(tokens: AuthTokens, { tabOnly = getSession()?.tabOnly ?? false } = {}) {
  if (tabOnly) {
    const stored: Stored = {
      accessToken: tokens.access_token,
      cableToken: tokens.cable_token,
      refreshToken: tokens.refresh_token,
      user: tokens.user,
      tabOnly,
    };
    writeStore("tab", JSON.stringify(stored));
  } else {
    writeStore("tab", null);
    access = { userId: tokens.user.id, token: tokens.access_token, cableToken: tokens.cable_token };
    // The refresh token went into the cookie; a body one means the API didn't set it.
    const stored: Stored = { user: tokens.user, ...(tokens.refresh_token && { refreshToken: tokens.refresh_token }) };
    writeStore("local", JSON.stringify(stored));
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

// The user changed (POST /me/register): the same tokens, wherever they are kept.
export function saveSessionUser(user: User) {
  const store: Store = getSession()?.tabOnly ? "tab" : "local";
  const stored = parse(readStore(store));
  if (!stored) return;
  writeStore(store, JSON.stringify({ ...stored, user }));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

// Ends the session in use: a trip link's, which uncovers this browser's own, if any. `all`
// (signing out) ends both.
export function clearSession({ all = false } = {}) {
  const tabOnly = getSession()?.tabOnly;
  if (all || tabOnly) writeStore("tab", null);
  if (all || !tabOnly) {
    writeStore("local", null);
    access = null;
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

// A guest with no email yet (RAA-175): made by their first add, they give their contact
// details at their first checkout. Signed out, for the header and the sign-in pages.
export function isAnonymous(session: Session | null | undefined) {
  return session?.user.role === "guest" && session.user.email === null;
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange); // other tabs
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

// A string, so React sees the same snapshot until the session or this tab's token changes.
function snapshot(): string | null {
  const session = getSession();
  return session && JSON.stringify(session);
}

// The current session: `undefined` while it can't be known yet (the server render and
// hydration), then the session or `null` when signed out. Guards must wait out
// `undefined` rather than treat it as signed out.
export function useSession(): Session | null | undefined {
  const raw = useSyncExternalStore<string | null | undefined>(subscribe, snapshot, () => undefined);
  if (raw === undefined) return undefined;
  return raw === null ? null : (JSON.parse(raw) as Session);
}
