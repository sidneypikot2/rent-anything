"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Card, CardBody } from "@/components/ui/card";
import { Toast } from "@/components/ui/toast";
import { SectionTitle } from "@/components/ui/typography";
import { formatDateRange, todayIso } from "@/lib/dates";
import { formatPeso } from "@/lib/money";
import { BookingSheet } from "./calendar/calendar-sheets";
import { usePartnerRequests, type CalendarBooking } from "./use-partner-calendar";

function answerBy(iso: string) {
  return new Date(iso).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

// The requests waiting for the partner's answer (RAA-261), each opening the booking's sheet with
// Accept and Decline. ?booking=<id> (a request email's link) opens that one, then leaves the URL;
// one already answered or expired isn't here, so it just shows the list.
export function BookingRequests() {
  const { data: requests, isError } = usePartnerRequests();
  const [open, setOpen] = useState<CalendarBooking | null>(null);
  const [toast, setToast] = useState<{ message: string; id: number } | null>(null);
  const [today] = useState(todayIso);
  const bookingParam = useSearchParams().get("booking");
  const [openedParam, setOpenedParam] = useState<string | null>(null);
  if (bookingParam && bookingParam !== openedParam && requests) {
    setOpenedParam(bookingParam);
    setOpen(requests.find((item) => item.id === Number(bookingParam)) ?? null);
  }
  useEffect(() => {
    if (!openedParam) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("booking");
    history.replaceState(null, "", url.pathname + url.search + url.hash);
  }, [openedParam]);

  return (
    <section data-testid="booking-requests" className="flex flex-col gap-3">
      <SectionTitle>Booking requests</SectionTitle>
      {isError ? (
        <p role="alert" className="text-sm text-danger">
          The requests couldn&apos;t load. Refresh the page to try again.
        </p>
      ) : requests?.length === 0 ? (
        <p className="text-sm text-muted">No requests to answer. New ones show up here and in your email.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {requests?.map((booking) => (
            <li key={booking.id}>
              <button type="button" className="w-full text-left" onClick={() => setOpen(booking)} data-testid="booking-request">
                <Card>
                  <CardBody>
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <span className="font-semibold">{booking.guest_name}</span>
                      <span className="font-semibold">{booking.to_be_agreed ? "To be agreed" : formatPeso(booking.payout_cents)}</span>
                    </div>
                    <p className="text-sm text-muted">
                      {booking.listing.title} · {formatDateRange(booking.starts_on, booking.ends_on)}
                    </p>
                    {booking.expires_at && <p className="text-sm text-muted">Answer by {answerBy(booking.expires_at)}</p>}
                  </CardBody>
                </Card>
              </button>
            </li>
          ))}
        </ul>
      )}
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
      <Toast message={toast?.message ?? null} id={toast?.id} onDismiss={() => setToast(null)} data-testid="requests-toast" />
    </section>
  );
}
