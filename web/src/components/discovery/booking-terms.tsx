import type { ListingDetail } from "@/api/discovery";
import { CANCELLATION_POLICY } from "@/components/bookings/cancellation";
import { cn } from "@/components/ui/cn";
import { BoltGlyph, ClockGlyph, FeatureGlyph } from "./tag-glyphs";

// A listing's terms before a guest adds it, by its price, as Klook shows them: whether it can be
// cancelled for free, and whether it's confirmed at once or by the partner (who has 24 hours, as
// the cart's item panel says).
export function BookingTerms({
  listing,
  className,
}: {
  listing: Pick<ListingDetail, "cancellation_policy" | "instant_book">;
  className?: string;
}) {
  const policy = CANCELLATION_POLICY[listing.cancellation_policy];
  const refundable = listing.cancellation_policy !== "non_refundable";

  return (
    <ul data-testid="booking-terms" aria-label="Booking terms" className={cn("flex flex-col gap-2 text-sm", className)}>
      {policy && (
        <li className={`flex items-center gap-2 font-semibold ${refundable ? "text-emerald" : "text-muted"}`}>
          <FeatureGlyph name="cancellation" className="size-4 shrink-0" />
          {policy.rule}
        </li>
      )}
      <li className="flex items-center gap-2 text-muted">
        {listing.instant_book ? (
          <>
            <BoltGlyph className="size-4 shrink-0 text-primary" />
            Instant confirmation
          </>
        ) : (
          <>
            <ClockGlyph className="size-4 shrink-0 text-primary" />
            The partner confirms within 24 hours
          </>
        )}
      </li>
    </ul>
  );
}
