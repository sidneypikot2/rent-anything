"use client";

import { useState } from "react";
import { BOOKING_STATUS } from "@/components/bookings/booking-status";
import { Section } from "@/components/ui/section";
import type { DashboardActivity } from "../use-partner-dashboard";

const RELATIVE = new Intl.RelativeTimeFormat("en", { numeric: "auto", style: "short" });

function ago(iso: string, now: number) {
  const seconds = Math.max(0, (now - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return RELATIVE.format(-Math.floor(seconds / 60), "minute");
  if (seconds < 86400) return RELATIVE.format(-Math.floor(seconds / 3600), "hour");
  return RELATIVE.format(-Math.floor(seconds / 86400), "day");
}

// Who made the change, from the partner's side: admin is the team answering for them.
const ACTOR: Record<DashboardActivity["actor"], string> = { guest: "Guest", partner: "You", admin: "Our team", system: "Automatic" };

// What happened, from the partner's side: BOOKING_STATUS says "Request sent", the guest's words.
function change(event: DashboardActivity) {
  if (event.to_status === "requested") return "new request";
  if (event.from_status === null) return "new booking";
  return BOOKING_STATUS[event.to_status].label.toLowerCase();
}

// The last status changes on the partner's bookings (RAA-284; the API's last ten).
export function RecentActivity({ activity }: { activity: DashboardActivity[] }) {
  const [now] = useState(Date.now);
  if (activity.length === 0) return null;

  return (
    <Section testId="recent-activity" title="Recent activity">
      <ul className="flex flex-col gap-2 text-sm">
        {activity.map((event) => (
          <li key={event.id} className="flex flex-wrap items-baseline justify-between gap-x-4">
            <span>
              <span className="font-semibold">{event.guest_name}</span> · {event.listing_title}:{" "}
              {change(event)}
            </span>
            <span className="text-muted">
              {ACTOR[event.actor]} · {ago(event.created_at, now)}
            </span>
          </li>
        ))}
      </ul>
    </Section>
  );
}
