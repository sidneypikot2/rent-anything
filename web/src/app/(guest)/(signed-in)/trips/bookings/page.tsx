import type { Metadata } from "next";
import { BookingsView } from "@/components/bookings/bookings-view";
import { PageBanner } from "@/components/landing/page-banner";
import { PageSheet } from "@/components/landing/page-sheet";
import { ButtonLink } from "@/components/ui/button";
import { DisplayTitle } from "@/components/ui/typography";

export const metadata: Metadata = {
  title: "Bookings",
};

// The guest's bookings (RAA-133), under Trips: /bookings would take a name an area could
// have (Area::RESERVED_SLUGS).
export default function Bookings() {
  return (
    <main data-testid="bookings" className="flex flex-1 flex-col">
      <PageBanner title={<DisplayTitle size="compact">Bookings</DisplayTitle>} search={false} compact>
        <ButtonLink href="/trips" variant="soft" size="sm">
          All trips
        </ButtonLink>
      </PageBanner>
      <PageSheet>
        <div className="mx-auto flex w-full max-w-narrow flex-col gap-6 px-gutter pb-page-pad pt-6">
          <BookingsView />
        </div>
      </PageSheet>
    </main>
  );
}
