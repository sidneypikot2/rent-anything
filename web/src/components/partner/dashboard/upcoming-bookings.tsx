"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Section } from "@/components/ui/section";
import { addDays, formatDateRange, localTodayIso } from "@/lib/dates";
import { formatPeso } from "@/lib/money";
import type { CalendarBooking } from "../use-partner-calendar";

// The next confirmed bookings from today (RAA-284; the API sends up to five), each opening the
// calendar's booking sheet. "Today" is the partner's own calendar day, as the API's is Manila's.
export function UpcomingBookings({ bookings, onOpenBooking }: { bookings: CalendarBooking[]; onOpenBooking: (booking: CalendarBooking) => void }) {
  const [today] = useState(localTodayIso);
  const tomorrow = addDays(today, 1);

  return (
    <Section
      testId="upcoming-bookings"
      title="Coming up"
      action={
        <Link href="/partner/calendar" className="text-sm font-semibold text-link underline underline-offset-4">
          See calendar
        </Link>
      }
    >
      {bookings.length === 0 ? (
        <p className="text-sm text-muted">No confirmed bookings ahead yet.</p>
      ) : (
        <Card edge="line">
          <ul className="divide-y divide-line">
            {bookings.map((booking) => {
              const when = booking.starts_on === today ? "Today" : booking.starts_on === tomorrow ? "Tomorrow" : null;
              return (
                <li key={booking.id}>
                  <button
                    type="button"
                    onClick={() => onOpenBooking(booking)}
                    data-testid="upcoming-booking"
                    className="flex w-full flex-wrap items-baseline justify-between gap-x-4 gap-y-1 p-4 text-left transition-colors duration-300 ease-calm hover:bg-surface-2"
                  >
                    <span className="flex min-w-0 flex-col">
                      <span className="flex items-center gap-2 font-semibold">
                        {booking.guest_name}
                        {when && <Badge tone={when === "Today" ? "warning" : "aqua"}>{when}</Badge>}
                      </span>
                      <span className="text-sm text-muted">
                        {booking.listing.title} · {formatDateRange(booking.starts_on, booking.ends_on)}
                      </span>
                    </span>
                    <span className="font-semibold">{booking.to_be_agreed ? "To be agreed" : formatPeso(booking.payout_cents)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </Section>
  );
}
