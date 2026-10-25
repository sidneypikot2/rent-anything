import { useSyncExternalStore } from "react";
import type { components } from "@/api/schema";

export type User = components["schemas"]["user"];
export type AuthTokens = components["schemas"]["auth_tokens"];
// tabOnly: a trip link's session (RAA-177), kept in this tab's sessionStorage only, so
// closing the tab ends it and the next open of the link asks for the PIN again.
export type Session = { accessToken: string; refreshToken: string; user: User; tabOnly?: boolean };

// The signed-in session lives in this browser's localStorage: an access token (15 min),
// the refresh token that renews it, and the user. A trip link's session lives in this tab's
// sessionStorage instead, and while there is one it is the session. Storage can throw
// (private windows, blocked site data); then the session is kept in memory and lasts until
// the page reloads.
const KEY = "raa.session";
const CHANGE_EVENT = "raa:session";

type Store = "local" | "tab";
const memory: Record<Store, string | null> = { local: null, tab: null };
let storageFailed = false;

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

function readRaw(): string | null {
  return readStore("tab") ?? readStore("local");
}

function parse(raw: string | null): Session | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export function getSession(): Session | null {
  return parse(readRaw());
}

// A refresh keeps the session where it was: a trip link's stays in the tab. Any other
// sign-in ends a trip link's session in this tab.
export function saveSession(tokens: AuthTokens, { tabOnly = getSession()?.tabOnly ?? false } = {}) {
  const session: Session = {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    user: tokens.user,
    ...(tabOnly && { tabOnly }),
  };
  if (!tabOnly) writeStore("tab", null);
  writeStore(tabOnly ? "tab" : "local", JSON.stringify(session));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

// The user changed (POST /me/register): the same tokens, wherever they are kept.
export function saveSessionUser(user: User) {
  const session = getSession();
  if (!session) return;
  writeStore(session.tabOnly ? "tab" : "local", JSON.stringify({ ...session, user }));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

// Ends the session in use: a trip link's, which uncovers this browser's own, if any. `all`
// (signing out) ends both.
export function clearSession({ all = false } = {}) {
  const tabOnly = getSession()?.tabOnly;
  if (all || tabOnly) writeStore("tab", null);
  if (all || !tabOnly) writeStore("local", null);
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

// The current session: `undefined` while it can't be known yet (the server render and
// hydration), then the session or `null` when signed out. Guards must wait out
// `undefined` rather than treat it as signed out.
export function useSession(): Session | null | undefined {
  const raw = useSyncExternalStore<string | null | undefined>(subscribe, readRaw, () => undefined);
  return raw === undefined ? undefined : parse(raw);
}
