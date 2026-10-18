import { Badge } from "@/components/ui/badge";
import type { BookingStatus } from "./use-bookings";

// A booking's status as guests and partners read it (RAA-133). Green for booked, the
// highlight for waiting on someone, plain for what is over.
export const BOOKING_STATUS: Record<BookingStatus, { label: string; tone: "emerald" | "aqua" | "mist" | "warning" }> = {
  requested: { label: "Request sent", tone: "aqua" },
  accepted: { label: "Accepted", tone: "aqua" },
  awaiting_payment: { label: "Awaiting payment", tone: "aqua" },
  confirmed: { label: "Confirmed", tone: "emerald" },
  in_progress: { label: "Under way", tone: "emerald" },
  completed: { label: "Completed", tone: "mist" },
  declined: { label: "Declined", tone: "warning" },
  cancelled: { label: "Cancelled", tone: "mist" },
  expired: { label: "Expired", tone: "mist" },
};

export function BookingStatusBadge({ status, small = false }: { status: BookingStatus; small?: boolean }) {
  const { label, tone } = BOOKING_STATUS[status];
  return (
    <Badge tone={tone} className={small ? "min-h-6 px-2.5 text-xs" : undefined} data-testid="booking-status">
      {label}
    </Badge>
  );
}
