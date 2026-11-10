"use client";

import { useState } from "react";
import { Toast } from "@/components/ui/toast";
import { todayIso } from "@/lib/dates";
import { BookingSheet } from "../calendar/calendar-sheets";
import type { CalendarBooking } from "../use-partner-calendar";

// The calendar's booking sheet (Accept, Decline, Cancel) for a booking shown on the dashboard,
// with the toast that says what was done. `element` goes once in the page.
export function useBookingSheet() {
  const [open, setOpen] = useState<CalendarBooking | null>(null);
  const [toast, setToast] = useState<{ message: string; id: number } | null>(null);
  const [today] = useState(todayIso);

  const element = (
    <>
      {open && (
        <BookingSheet
          listing={open.listing}
          booking={open}
          today={today}
          onClose={() => setOpen(null)}
          onDone={(message) => {
            setOpen(null);
            setToast({ message, id: Date.now() });
          }}
        />
      )}
      <Toast message={toast?.message ?? null} id={toast?.id} onDismiss={() => setToast(null)} data-testid="dashboard-toast" />
    </>
  );

  return { show: setOpen, element };
}
