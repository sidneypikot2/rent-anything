import { PageSheet } from "@/components/landing/page-sheet";
import { ButtonLink } from "@/components/ui/button";
import { DisplayTitle } from "@/components/ui/typography";

// A destination slug we don't have (RAA-85). The guest header and footer stay, so search
// is still a click away.
export default function AreaNotFound() {
  return (
    <main className="flex flex-1 flex-col pt-3 sm:pt-6">
      <PageSheet>
        <div className="mx-auto flex w-full max-w-page flex-1 flex-col items-start gap-4 px-gutter py-page-pad">
          <DisplayTitle>We don&apos;t cover that place yet</DisplayTitle>
          <p className="max-w-prose text-muted">
            The link may be old, or the place may not have local partners on board yet. Start from the
            destinations we do cover, or search for a beach, a town or an activity.
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
