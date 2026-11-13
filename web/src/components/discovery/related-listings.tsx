import Link from "next/link";
import { ListingRow, type RowCard } from "@/components/area/listing-row";
import { BOOKING_GROUPS } from "@/components/discovery/categories";
import { ArrowGlyph } from "@/components/discovery/tag-glyphs";
import { Section } from "@/components/ui/section";

// Under a listing's page, after More from its business: a few other listings of its kind on the
// place it was opened from (RAA-237), the place's own cards (`rowCardsOf`), with a link to the
// rest of them on What to book. Internal links for search engines and a next step for a guest
// whose pick didn't suit.
export function RelatedListings({
  cards,
  group,
  place,
  allHref,
}: {
  cards: RowCard[];
  group: (typeof BOOKING_GROUPS)[number]["group"];
  place: string;
  allHref: string;
}) {
  if (cards.length === 0) return null;
  const title = BOOKING_GROUPS.find((each) => each.group === group)?.title ?? "listings";
  return (
    <Section
      testId="listing-related"
      title={`Other ${title.toLowerCase()} on ${place}`}
      action={
        <Link href={allHref} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-link underline-offset-4 hover:underline">
          See all on {place} <ArrowGlyph className="size-4" />
        </Link>
      }
      className="max-sm:px-3"
    >
      <ListingRow cards={cards} kind={group} noun={title.toLowerCase()} testId="listing-related-row" bleed="sheet" />
    </Section>
  );
}
