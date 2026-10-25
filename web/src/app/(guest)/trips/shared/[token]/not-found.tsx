import { PageSheet } from "@/components/landing/page-sheet";
import { ButtonLink } from "@/components/ui/button";
import { DisplayTitle } from "@/components/ui/typography";

// A share link that is unknown, or one its traveller replaced or stopped sharing (RAA-178).
export default function SharedTripNotFound() {
  return (
    <main className="flex flex-1 flex-col pt-3 sm:pt-6">
      <PageSheet>
        <div
          data-testid="shared-trip-missing"
          className="mx-auto flex w-full max-w-page flex-1 flex-col items-start gap-4 px-gutter py-page-pad"
        >
          <DisplayTitle>This trip isn&apos;t shared any more</DisplayTitle>
          <p className="max-w-prose text-muted">
            The link may be old: whoever sent it may have made a new one or stopped sharing. Ask them for the latest
            link, or plan a trip of your own.
          </p>
          <ButtonLink href="/">Plan your own trip</ButtonLink>
        </div>
      </PageSheet>
    </main>
  );
}
