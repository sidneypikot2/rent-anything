"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { apiClient } from "@/api/client";
import { clearSession, useSession } from "@/lib/auth/session";

class GuardError extends Error {
  constructor(readonly status: number) {
    super(`partner check failed (${status})`);
  }
}

// Everything under /partner except /partner/login: signed out → /partner/login, a guest
// (or admin) → /. The page renders only once the API confirms a partner
// (GET /api/v1/partner/me), which is also what keeps partner data safe if this client
// check is bypassed.
export function PartnerGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const session = useSession();
  const isPartner = session?.user.role === "partner";

  const { data, error } = useQuery({
    queryKey: ["partner-me", session?.user.id],
    queryFn: async () => {
      const { data, response } = await apiClient().GET("/api/v1/partner/me");
      if (!data) throw new GuardError(response.status);
      return data;
    },
    enabled: isPartner,
    retry: false,
  });

  useEffect(() => {
    if (session === undefined) return; // not known until hydration finishes
    if (session === null) router.replace("/partner/login");
    else if (!isPartner) router.replace("/");
  }, [session, isPartner, router]);

  useEffect(() => {
    if (!(error instanceof GuardError)) return;
    if (error.status === 401) clearSession(); // the effect above then sends them to log in
    else router.replace("/");
  }, [error, router]);

  if (!isPartner || !data) {
    return (
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-12">
        <p data-testid="partner-guard" className="text-sm text-muted">
          Checking your partner account…
        </p>
      </main>
    );
  }
  return children;
}
