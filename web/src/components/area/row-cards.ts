import type { PlanGroup } from "@/api/discovery";
import type { RowCard } from "@/components/area/listing-row";
import { businessHref, cardKey, isTitleCard, titleCardHref, type BrowseListing } from "@/components/discovery/browse-offers";
import { listingFeatures } from "@/components/discovery/listing-features";
import type { TripDates } from "@/components/trips/trip-dates";
import { formatPeso } from "@/lib/money";
import { pricedByText, priceUnitText } from "@/lib/pricing";

// A row's cards (`ListingRow`), as What to book groups them (byCard; `book_cards`' cards): a stay's
// per business (its name, what it sells), any other per listing title of a business ("Mio 125",
// "by <business>"), with the lowest price, a stay's opening the business's page on that group, a
// title card's its listing's page. Priced cards first, then those with a photo, as What to book
// leads. `keep` narrows the group's listings first (Vehicle rental's on-island transfers). `slug`
// is the place the links carry (`?place=`); from that place's own page (`fromPlace`) a listing's
// way back is that page, else its What to book. The place's card rows and a listing's "Other …
// on <place>" (RAA-237) both use it.
export function rowCardsOf(
  cards: BrowseListing[][],
  group: PlanGroup,
  { dates, slug, fromPlace = false, keep = () => true }: { dates: TripDates; slug: string; fromPlace?: boolean; keep?: (listing: BrowseListing) => boolean },
): RowCard[] {
  return cards
    .map((card) => card.filter(keep))
    .filter((card) => card.length > 0)
    .map((offered) => {
      const first = offered[0];
      const priced = offered.filter((listing) => listing.price_from_cents);
      const cheapest = priced.sort((a, b) => a.price_from_cents! - b.price_from_cents!)[0];
      const cover = offered.find((listing) => listing.cover_photo_url);
      const titled = isTitleCard(first);
      const forSale = titled
        ? [`by ${first.business.name}`, offered.length > 1 && `${offered.length} options`].filter(Boolean).join(" · ")
        : offered.length === 1
          ? first.title
          : `${first.title} + ${offered.length - 1} more`;
      const onePlace = offered.every((listing) => listing.area_slug === first.area_slug) ? first.area_name : null;
      const trusts = offered.map((listing) => listingFeatures(listing).find((feature) => feature.trust)?.label);
      return {
        id: `${group}-${cardKey(first)}`,
        href: titled ? titleCardHref(offered, dates, slug, fromPlace) : businessHref(first.business.id, dates, `need-${group}`, slug),
        title: titled ? first.title : first.business.name,
        category: first.category,
        note: onePlace ? `${forSale} · ${onePlace}` : forSale,
        photo: cover ? { src: cover.cover_photo_url!, alt: cover.title } : undefined,
        price: cheapest
          ? { prefix: "from", amount: formatPeso(cheapest.price_from_cents!), unit: priceUnitText(cheapest.price_unit) }
          : undefined,
        unpriced: pricedByText(first.booking_type),
        instantBook: offered.every((listing) => listing.instant_book),
        trust: trusts.every((label) => label && label === trusts[0]) ? trusts[0] : undefined,
        kind: group,
      };
    })
    .sort((a, b) => Number(!a.price) - Number(!b.price) || Number(!a.photo) - Number(!b.photo));
}
