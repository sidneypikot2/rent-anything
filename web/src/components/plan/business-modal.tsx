"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Dialog } from "@/components/ui/dialog";
import { closeOverPlan } from "./over-plan";

// The plan's business page on a phone: a full-screen dialog over the checklist, opened by the
// plan's `?business=` (over-plan.ts). Closing it is Back when this tab opened it, else the plan's URL.
export function BusinessModal({ title, meta, children }: { title: string; meta: string; children: ReactNode }) {
  const router = useRouter();
  return (
    <Dialog open onClose={() => closeOverPlan(router)} title={title} meta={meta} placement="full" data-testid="plan-business-modal">
      <div className="h-full overflow-y-auto overscroll-contain">{children}</div>
    </Dialog>
  );
}
