import type { User } from "./session";

type Role = User["role"];

// Where each role lands after signing in, and where it signs in.
export const DASHBOARD_PATHS: Record<Role, string> = {
  guest: "/dashboard",
  partner: "/partner/dashboard",
  admin: "/admin",
};

export const LOGIN_PATHS: Record<Role, string> = {
  guest: "/login",
  partner: "/partner/login",
  admin: "/admin",
};

// Where the self-serve roles sign up. Admins are never self-made.
export const REGISTER_PATHS: Record<Exclude<Role, "admin">, string> = {
  guest: "/register",
  partner: "/partner/register",
};

// A `next` path to come back to after signing in, if it's safe to follow: a path on this
// site only ("/bantayan-island?from=…"), never "//host" or "/\host", which browsers treat
// as another site. Browsers drop tabs and newlines from a URL ("/\t/host" is "//host"), so
// control characters and backslashes are refused anywhere in it.
export function safeNextPath(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return undefined;
  if (/[\u0000-\u001f\u007f\\]/.test(value)) return undefined;
  return value;
}

// A sign-in or sign-up path that brings the guest back to `next` afterwards.
export function withNext(path: string, next: string | undefined) {
  return next ? `${path}?next=${encodeURIComponent(next)}` : path;
}
