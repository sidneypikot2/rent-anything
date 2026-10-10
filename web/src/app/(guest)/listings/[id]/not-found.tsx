import { ButtonLink } from "@/components/ui/button";
import { DisplayTitle } from "@/components/ui/typography";

// A listing that is unknown, or not active (a draft, or waiting for review) (RAA-90).
export default function ListingNotFound() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-start gap-4 px-4 py-16">
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
    </main>
  );
}
