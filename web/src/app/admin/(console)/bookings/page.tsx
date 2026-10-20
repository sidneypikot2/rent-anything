import type { Metadata } from "next";
import { BookingRequests } from "@/components/admin/booking-requests";

export const metadata: Metadata = {
  title: "Booking requests",
};

export default function AdminBookingsPage() {
  return <BookingRequests />;
}
