import { BOOKING_STATUS } from "@/components/bookings/booking-status";
import type { AdminBooking } from "./use-admin-bookings";

// Money as plain pesos, so a spreadsheet can add them up; formatPeso's symbol would make text.
function pesos(cents: number | null) {
  return cents == null ? null : (cents / 100).toFixed(2);
}

const COLUMNS: [string, (booking: AdminBooking) => string | number | boolean | null | undefined][] = [
  ["Reference", (b) => b.reference],
  ["Status", (b) => BOOKING_STATUS[b.status]?.label ?? b.status],
  ["Type", (b) => b.booking_type],
  ["Listing", (b) => b.listing.title],
  ["Area", (b) => b.listing.area],
  ["Partner business", (b) => b.partner.business],
  ["Partner name", (b) => b.partner.name],
  ["Partner email", (b) => b.partner.email],
  ["Partner phone", (b) => b.partner.phone],
  ["Traveller", (b) => b.traveller?.name ?? b.guest_name],
  ["Traveller email", (b) => b.traveller?.email],
  ["Traveller phone", (b) => b.traveller?.phone],
  ["Starts on", (b) => b.starts_on],
  ["Ends on", (b) => b.ends_on],
  ["Quantity", (b) => b.quantity],
  ["Guests", (b) => b.guests],
  ["Total (PHP)", (b) => (b.to_be_agreed ? null : pesos(b.total_cents))],
  ["To be agreed", (b) => (b.to_be_agreed ? "Yes" : "No")],
  ["Platform fee (PHP)", (b) => pesos(b.commission_cents)],
  ["Refund (PHP)", (b) => pesos(b.refund_cents)],
  ["Source", (b) => b.source],
  ["Booking mode", (b) => b.booking_mode],
  ["Booked at", (b) => b.created_at],
  ["Answer or pay by", (b) => b.expires_at],
  ["Answered at", (b) => b.responded_at],
  ["Notes", (b) => b.notes],
];

// One cell, quoted RFC 4180 style. A value a spreadsheet would run as a formula (names and
// notes are typed by people) is led by an apostrophe, so it stays text; a phone number
// (+63 917 …) can't hold a formula and is left as it is.
function cell(value: string | number | boolean | null | undefined) {
  if (value == null) return "";
  let text = String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text) && !/^\+[\d ()-]+$/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

// The bookings on screen as a CSV, with a byte-order mark so Excel reads it as UTF-8.
export function bookingsCsv(bookings: AdminBooking[]) {
  const rows = [COLUMNS.map(([header]) => header), ...bookings.map((b) => COLUMNS.map(([, value]) => value(b)))];
  return "﻿" + rows.map((row) => row.map(cell).join(",")).join("\r\n") + "\r\n";
}

export function downloadCsv(filename: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  // Freed a moment later: some browsers start the download after click() returns.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
