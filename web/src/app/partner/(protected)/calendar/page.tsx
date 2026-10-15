import { PartnerCalendar } from "@/components/partner/calendar/partner-calendar";
import { DisplayTitle } from "@/components/ui/typography";

// The partner calendar (RAA-120): every listing's days, bookings and blocked dates.
export default function PartnerCalendarPage() {
  return (
    <main data-testid="partner-calendar" className="mx-auto flex w-full max-w-page flex-1 flex-col gap-block px-gutter py-page-pad">
      <DisplayTitle>Calendar</DisplayTitle>
      <PartnerCalendar />
    </main>
  );
}
