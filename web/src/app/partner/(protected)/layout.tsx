import type { ReactNode } from "react";
import { RoleGuard } from "@/components/auth/role-guard";

// Every partner page except /partner/login lives in this group, behind the guard.
export default function ProtectedPartnerLayout({ children }: { children: ReactNode }) {
  return <RoleGuard role="partner">{children}</RoleGuard>;
}
