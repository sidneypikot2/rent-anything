"use client";

import { useCallback, useState } from "react";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Toast } from "@/components/ui/toast";
import { todayIso } from "@/lib/dates";
import { usePartnerCalendar, type CalendarBlock, type CalendarBooking, type CalendarListing } from "../use-partner-calendar";
import { CalendarGrid, type Selection } from "./calendar-grid";
import { BlockSheet, BookingSheet, DayActionsSheet, JoinerDaySheet } from "./calendar-sheets";

type Sheet =
  | { kind: "days"; selection: Selection }
  | { kind: "booking"; listing: CalendarListing; booking: CalendarBooking }
  | { kind: "block"; listing: CalendarListing; block: CalendarBlock }
  | { kind: "joiners"; listing: CalendarListing; date: string };

// The partner calendar page (RAA-120): the grid, the sheet for whatever was picked on it,
// and a toast once a change is saved. Sheets hold the listing id and look the listing up in
// the latest data, so they show the calendar as it is after each change.
export function PartnerCalendar() {
  const query = usePartnerCalendar();
  const { calendar, fetchPreviousPage, fetchNextPage, isFetchingPreviousPage, isFetchingNextPage } = query;
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [toast, setToast] = useState<{ message: string; id: number } | null>(null);
  const [today] = useState(todayIso);

  const loadEarlier = useCallback(() => {
    if (!isFetchingPreviousPage) void fetchPreviousPage();
  }, [fetchPreviousPage, isFetchingPreviousPage]);
  const loadLater = useCallback(() => {
    if (!isFetchingNextPage) void fetchNextPage();
  }, [fetchNextPage, isFetchingNextPage]);

  const onSelect = useCallback((selection: Selection) => setSheet({ kind: "days", selection }), []);
  const onJoinerDay = useCallback(
    (listing: CalendarListing, date: string) => setSheet({ kind: "joiners", listing, date }),
    [],
  );

  if (query.isError) {
    return (
      <p role="alert" className="text-sm text-danger" data-testid="calendar-error">
        The calendar couldn&apos;t load. Refresh the page to try again.
      </p>
    );
  }
  if (!calendar) {
    return (
      <p className="text-sm text-muted" data-testid="calendar-loading">
        Loading your calendar…
      </p>
    );
  }
  if (calendar.listings.length === 0) {
    return (
      <Card data-testid="calendar-empty">
        <CardBody className="flex flex-col items-start gap-3">
          <p className="text-lg font-semibold">Your calendar fills in once you have a listing</p>
          <p className="text-sm text-muted">Each listing gets a row, with its prices, bookings and blocked days.</p>
          <ButtonLink href="/partner/listings/new" size="sm">
            Add a listing
          </ButtonLink>
        </CardBody>
      </Card>
    );
  }

  const fresh = (listing: CalendarListing) => calendar.listings.find((item) => item.id === listing.id) ?? listing;
  const close = () => setSheet(null);
  const done = (message: string) => {
    setSheet(null);
    setToast({ message, id: Date.now() });
  };

  return (
    <>
      <CalendarGrid
        listings={calendar.listings}
        today={today}
        onSelect={onSelect}
        onBooking={(listing, booking) => setSheet({ kind: "booking", listing, booking })}
        onBlock={(listing, block) => setSheet({ kind: "block", listing, block })}
        onJoinerDay={onJoinerDay}
        loadEarlier={loadEarlier}
        loadLater={loadLater}
      />

      {sheet?.kind === "days" && (
        <DayActionsSheet
          selection={{ ...sheet.selection, listing: fresh(sheet.selection.listing) }}
          onClose={close}
          onDone={done}
        />
      )}
      {sheet?.kind === "booking" && (
        <BookingSheet listing={fresh(sheet.listing)} booking={sheet.booking} today={today} onClose={close} onDone={done} />
      )}
      {sheet?.kind === "block" && (
        <BlockSheet listing={fresh(sheet.listing)} block={sheet.block} onClose={close} onDone={done} />
      )}
      {sheet?.kind === "joiners" && (
        <JoinerDaySheet
          listing={fresh(sheet.listing)}
          date={sheet.date}
          today={today}
          onClose={close}
          onDone={done}
          onAdd={() =>
            setSheet({ kind: "days", selection: { listing: sheet.listing, from: sheet.date, to: sheet.date } })
          }
        />
      )}

      <Toast message={toast?.message ?? null} id={toast?.id} onDismiss={() => setToast(null)} data-testid="calendar-toast" />
    </>
  );
}
