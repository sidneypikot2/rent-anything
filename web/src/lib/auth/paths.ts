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

// Sign-up takes only email and password; name and phone are set here next (RAA-32).
export const COMPLETE_PROFILE_PATHS: Record<Exclude<Role, "admin">, string> = {
  guest: "/complete-profile",
  partner: "/partner/complete-profile",
};

// Where a signed-in user belongs: their dashboard, or the complete-profile step until
// it's done. Admins have no such step.
export function homePathFor(user: User): string {
  if (user.role !== "admin" && !user.registration_complete) return COMPLETE_PROFILE_PATHS[user.role];
  return DASHBOARD_PATHS[user.role];
}
