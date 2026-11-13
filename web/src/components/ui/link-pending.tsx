"use client";

import { useLinkStatus } from "next/link";
import { createContext, useContext, type ReactNode } from "react";

// Set by a link that navigates itself (the planner's `PlanNavLink`, through router.push in a
// transition), whose Link's own status then never turns pending.
export const LinkPendingOverride = createContext<boolean | null>(null);

// Inside a Next `Link`: `pending` while the page it opens is loading, `idle` otherwise. A route
// with no loading skeleton keeps the old page until the new one is ready, so the link itself has
// to say it is working.
export function LinkPending({ idle = null, pending }: { idle?: ReactNode; pending: ReactNode }) {
  const status = useLinkStatus();
  const override = useContext(LinkPendingOverride);
  return (override || status.pending) ? pending : idle;
}
