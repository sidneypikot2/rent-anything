import { PageSheet } from "@/components/landing/page-sheet";
import { ButtonLink } from "@/components/ui/button";
import { DisplayTitle } from "@/components/ui/typography";

// A business that is unknown, or has nothing to book now.
export default function BusinessNotFound() {
  return (
    <main className="flex flex-1 flex-col pt-3 sm:pt-6">
      <PageSheet>
        <div className="mx-auto flex w-full max-w-page flex-1 flex-col items-start gap-4 px-gutter py-page-pad">
          <DisplayTitle>This business isn&apos;t taking bookings</DisplayTitle>
          <p className="max-w-prose text-muted">
            The link may be old, or the partner may have taken its listings down. Start from a destination, or search for
            a beach, a town or an activity.
          </p>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/">See destinations</ButtonLink>
            <ButtonLink href="/search" variant="soft">
              Search
            </ButtonLink>
          </div>
        </div>
      </PageSheet>
    </main>
  );
}
