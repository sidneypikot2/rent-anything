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
