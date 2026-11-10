import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { RoleGuard } from "@/components/auth/role-guard";

// Every admin console page (RAA-142) lives in this group, behind the guard, beside the console's
// tabs (AdminShell, RAA-289); /admin itself is the sign-in form and /admin/ui-kit the primitives
// showcase, both outside it.
export default function AdminConsoleLayout({ children }: { children: ReactNode }) {
  return (
    <RoleGuard role="admin">
      <AdminShell>{children}</AdminShell>
    </RoleGuard>
  );
}
