"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { apiClient } from "@/api/client";
import { Button } from "@/components/ui/button";
import { DASHBOARD_PATHS, LOGIN_PATHS } from "@/lib/auth/paths";
import { clearSession, useSession } from "@/lib/auth/session";
import { BRAND } from "@/lib/brand";

type GuardedRole = "guest" | "partner";

class GuardError extends Error {
  constructor(readonly status: number) {
    super(`account check failed (${status})`);
  }
}

// Asks the API who this is: partners through the partner-only endpoint (403 for anyone
// else), guests through /me plus a role check.
async function confirmRole(role: GuardedRole) {
  if (role === "partner") {
    const { data, response } = await apiClient().GET("/api/v1/partner/me");
    if (!data) throw new GuardError(response.status);
    return data;
  }
  const { data, response } = await apiClient().GET("/api/v1/me");
  if (!data) throw new GuardError(response.status);
  if (data.role !== role) throw new GuardError(403);
  return data;
}

// Pages for one role: signed out → that role's login, another role → its own dashboard.
// The page renders only once the API confirms the role, which is also what keeps the
// data safe if this client check is bypassed. Guest pages live in
// src/app/(guest)/(signed-in)/, partner pages in src/app/partner/(protected)/.
export function RoleGuard({ role, children }: { role: GuardedRole; children: ReactNode }) {
  const router = useRouter();
  const session = useSession();
  const hasRole = session?.user.role === role;

  const { data, error, refetch } = useQuery({
    queryKey: ["confirm-role", role, session?.user.id],
    queryFn: () => confirmRole(role),
    enabled: hasRole,
    retry: false,
  });

  useEffect(() => {
    if (session === undefined) return; // not known until hydration finishes
    if (session === null) router.replace(LOGIN_PATHS[role]);
    else if (!hasRole) router.replace(DASHBOARD_PATHS[session.user.role]);
  }, [session, hasRole, role, router]);

  useEffect(() => {
    if (!(error instanceof GuardError)) return;
    if (error.status === 401) clearSession(); // the effect above then sends them to log in
    else router.replace("/");
  }, [error, router]);

  // Not a 401/403 but no answer at all: the API is down or unreachable.
  if (hasRole && error && !(error instanceof GuardError)) {
    return (
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-start gap-3 px-4 py-12">
        <p role="alert" className="text-sm text-danger">
          Couldn&apos;t reach {BRAND}. Check your connection and try again.
        </p>
        <Button size="sm" variant="soft" onClick={() => void refetch()}>
          Try again
        </Button>
      </main>
    );
  }

  if (!hasRole || !data) {
    return (
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-12">
        <p data-testid="role-guard" className="text-sm text-muted">
          Checking your account…
        </p>
      </main>
    );
  }
  return children;
}
