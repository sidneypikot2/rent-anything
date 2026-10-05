import { useSyncExternalStore } from "react";
import type { components } from "@/api/schema";

export type User = components["schemas"]["user"];
export type AuthTokens = components["schemas"]["auth_tokens"];
export type Session = { accessToken: string; refreshToken: string; user: User };

// The signed-in session lives in this browser's localStorage: an access token (15 min),
// the refresh token that renews it, and the user. Storage can throw (private windows,
// blocked site data); then the session is kept in memory and lasts until the page reloads.
const KEY = "raa.session";
const CHANGE_EVENT = "raa:session";

let memory: string | null = null;
let storageFailed = false;

function readRaw(): string | null {
  if (storageFailed) return memory;
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    storageFailed = true;
    return memory;
  }
}

function writeRaw(value: string | null) {
  memory = value;
  try {
    if (value === null) window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, value);
  } catch {
    storageFailed = true;
  }
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

export function saveSession(tokens: AuthTokens) {
  const session: Session = {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    user: tokens.user,
  };
  writeRaw(JSON.stringify(session));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

// After the user changes on the server (completing their profile), keep the tokens.
export function updateSessionUser(user: User) {
  const session = getSession();
  if (!session) return;
  writeRaw(JSON.stringify({ ...session, user }));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function clearSession() {
  writeRaw(null);
  window.dispatchEvent(new Event(CHANGE_EVENT));
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
