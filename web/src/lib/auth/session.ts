import { useSyncExternalStore } from "react";
import type { components } from "@/api/schema";

export type User = components["schemas"]["user"];
export type AuthTokens = components["schemas"]["auth_tokens"];
export type Session = { accessToken: string; refreshToken: string; user: User };

// The signed-in session lives in this browser's localStorage: an access token (15 min),
// the refresh token that renews it, and the user. Storage can throw (private windows,
// blocked site data), so every access is guarded and a failure reads as signed out.
const KEY = "raa.session";
const CHANGE_EVENT = "raa:session";

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
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
  try {
    window.localStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    // Without storage the session lasts until the page reloads.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function clearSession() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Nothing stored.
  }
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
