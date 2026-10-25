"use client";

import { useState } from "react";
import type { components } from "@/api/schema";
import { Button } from "@/components/ui/button";

export type TripLink = components["schemas"]["trip_link"];

// The page a trip link opens (RAA-177): /trips/open/<token>, on this site.
export function tripLinkUrl(token: string) {
  return `${window.location.origin}/trips/open/${token}`;
}

// A guest's trip link and PIN, shown once (after their first checkout, or a reset): each with
// a copy button, and the warning that the PIN won't be shown again. `emailed`: the first
// checkout's pair is emailed too; a reset's isn't.
export function TripLinkCard({ link, emailed = false }: { link: TripLink; emailed?: boolean }) {
  return (
    <div data-testid="trip-link-card" className="flex flex-col gap-3 rounded-control border border-line bg-surface-2 p-4">
      <p className="text-sm font-semibold">Your trip link and PIN</p>
      <p className="text-sm text-muted">
        Open your trips from any device with this link, then the PIN.{emailed && " We've emailed these too."}
      </p>
      <CopyRow label="Trip link" value={tripLinkUrl(link.token)} testId="trip-link-url" />
      <CopyRow label="PIN" value={link.pin} testId="trip-link-pin" large />
      <p className="text-sm font-semibold text-warning">Save the PIN now: it won&apos;t be shown again.</p>
    </div>
  );
}

function CopyRow({ label, value, testId, large }: { label: string; value: string; testId: string; large?: boolean }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // No clipboard (an insecure origin, or refused): the value is on screen to copy by hand.
    }
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-xs font-semibold text-muted">{label}</span>
        <span
          data-testid={testId}
          className={large ? "font-display text-2xl font-extrabold tracking-widest tabular-nums" : "text-sm break-all"}
        >
          {value}
        </span>
      </span>
      <Button type="button" size="sm" variant="soft" onClick={() => void copy()} className="shrink-0">
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}
