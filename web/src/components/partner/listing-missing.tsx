import { ButtonLink } from "@/components/ui/button";

// A listing page whose listing the API says is a 404: deleted, or another partner's.
export function ListingMissing() {
  return (
    <div data-testid="listing-missing" className="flex flex-col items-start gap-3">
      <p className="text-sm text-muted">This listing doesn&apos;t exist, or it isn&apos;t one of yours.</p>
      <ButtonLink href="/partner/listings" size="sm" variant="soft">
        Back to listings
      </ButtonLink>
    </div>
  );
}
