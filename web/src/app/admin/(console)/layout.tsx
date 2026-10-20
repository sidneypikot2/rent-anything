import type { ReactNode } from "react";
import { RoleGuard } from "@/components/auth/role-guard";

// Every admin console page (RAA-142) lives in this group, behind the guard; /admin itself is
// the sign-in form and /admin/ui-kit the primitives showcase, both outside it.
export default function AdminConsoleLayout({ children }: { children: ReactNode }) {
  return <RoleGuard role="admin">{children}</RoleGuard>;
}
