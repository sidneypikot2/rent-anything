import { PageSheet } from "@/components/landing/page-sheet";
import { ButtonLink } from "@/components/ui/button";
import { DisplayTitle } from "@/components/ui/typography";

// A listing that is unknown, or not active (a draft, or waiting for review) (RAA-90).
export default function ListingNotFound() {
  return (
    <main className="flex flex-1 flex-col pt-3 sm:pt-6">
      <PageSheet>
        <div className="mx-auto flex w-full max-w-page flex-1 flex-col items-start gap-4 px-gutter py-page-pad">
          <DisplayTitle>This listing isn&apos;t available</DisplayTitle>
          <p className="max-w-prose text-muted">
            The link may be old, or the partner may have taken it down. Start from a destination, or search for
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
