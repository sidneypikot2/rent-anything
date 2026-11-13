import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { getBookCards, getListing, type ListingDetail } from "@/api/discovery";
import { bookHref } from "@/components/area/area-guide";
import { rowCardsOf } from "@/components/area/row-cards";
import { categoryIcon } from "@/components/discovery/icons";
import { InstantBookBadge } from "@/components/discovery/instant-book-badge";
import { ListingBody, listingId, loadListingView } from "@/components/discovery/listing-view";
import { CurrentPlace } from "@/components/landing/current-place";
import { PageBanner } from "@/components/landing/page-banner";
import { PageSheet } from "@/components/landing/page-sheet";
import { AdoptTrip } from "@/components/trips/trip-link";
import { BackLink } from "@/components/discovery/back-link";
import { RelatedListings } from "@/components/discovery/related-listings";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { tripDatesQuery } from "@/components/trips/trip-dates";
import { DisplayTitle } from "@/components/ui/typography";
import { BRAND } from "@/lib/brand";
import { formatPeso } from "@/lib/money";
import { pricedByText, priceUnitText } from "@/lib/pricing";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbJsonLd, listingJsonLd } from "@/lib/json-ld";
import { canonical, listingCrumbs, listingPath, metaDescription, openGraph } from "@/lib/seo";

export async function generateMetadata(props: PageProps<"/listings/[id]">): Promise<Metadata> {
  const id = listingId((await props.params).id);
  const listing = id ? await getListing(id) : null;
  if (!listing) return { title: "Not found" };
  return {
    title: listingTitle(listing),
    description: metaDescription(listing.summary || listingFallbackDescription(listing)),
    alternates: canonical(listingPath(listing)),
    // Shared with its cover photo (RAA-233).
    openGraph: openGraph(listingPath(listing), listing.photos[0] && { url: listing.photos[0].large_url, alt: listing.title }),
  };
}

// The title with where it is, or else what it is, while that keeps it short enough for a search
// result (about 60 characters with the brand; RAA-228): "Island hopping tour in Bantayan Island".
const TITLE_ROOM = 60 - ` · ${BRAND}`.length;

function listingTitle(listing: ListingDetail) {
  const { title, area, category } = listing;
  const inArea = `${title} in ${area.name}`;
  if (!title.toLowerCase().includes(area.name.toLowerCase()) && inArea.length <= TITLE_ROOM) return inArea;
  const kind = `${title} · ${category.name}`;
  return kind.length <= TITLE_ROOM && !title.toLowerCase().includes(category.name.toLowerCase()) ? kind : title;
}

// Kind · place · price when the partner wrote no description (RAA-229).
function listingFallbackDescription(listing: ListingDetail) {
  const { title, area, category, business, price_from_cents, price_unit, booking_type } = listing;
  const price = price_from_cents
    ? `From ${formatPeso(price_from_cents)}${price_unit ? ` ${priceUnitText(price_unit)}` : ""}.`
    : `${pricedByText(booking_type) ?? "Price on request"}.`;
  return `${title}: ${category.name.toLowerCase()} on ${area.name} by ${business.name}. ${price} Request it with the rest of your trip in one cart on ${BRAND}.`;
}

// "Kuya Jun Island Tours" → "KJ".
function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("");
}

// One listing, for a traveller deciding whether to add it to a trip (RAA-90), laid out as its
// business's shop page (RAA-281): a compact banner naming who offers it, then ListingBody. Active
// listings only. A plan step opens the same body in the planner's frame instead (`?listing=`).
// Its URL is `/listings/<id>-<slug of its title>` (RAA-236): any other (the bare id, an old title)
// answers 308 to that one with the same query, so the place, the trip, the dates and the way back
// (`?place=`, `&from=place`, `?plan=1`) go along. Redirected here, in the page, not its metadata,
// so it is a real 308 rather than one replayed after the page has started streaming.
export default async function ListingPage(props: PageProps<"/listings/[id]">) {
  const param = (await props.params).id;
  const id = listingId(param);
  if (!id) notFound();
  const searchParams = await props.searchParams;
  const found = await getListing(id);
  if (!found) notFound();
  const path = listingPath(found);
  if (`/listings/${param}` !== path) permanentRedirect(`${path}${queryOf(searchParams)}`);
  const view = await loadListingView(id, searchParams);
  if (!view) notFound();
  const { listing, business, from, dates, tripId, backHref, backLabel, businessHref, ancestors } = view;
  const { area, category } = listing;
  const crumbs = listingCrumbs(listing, ancestors);
  // A few other cards of its kind on the place it was opened from, not its own business's (More
  // from shows those); the page renders without them.
  const others = await getBookCards(from.slug, listing.group, RELATED + 4, undefined, undefined, undefined, 1, false).catch((error: unknown) => {
    console.error(error);
    return null;
  });
  const related = rowCardsOf(
    (others?.cards ?? [])
      .map((card) => card.listings)
      .filter((offered) => !offered.some((each) => each.business.id === listing.business.id)),
    listing.group,
    { dates, slug: from.slug },
  ).slice(0, RELATED);
  const chip = "inline-flex items-center gap-1 rounded-chip bg-glass-fill px-2.5 py-0.5 text-small font-semibold";

  return (
    <main className="flex flex-1 flex-col">
      <CurrentPlace name={from.name} slug={from.slug} />
      <JsonLd nodes={[listingJsonLd(listing), breadcrumbJsonLd(crumbs)]} />
      {tripId && <AdoptTrip id={tripId} />}
      <PageBanner
        compact
        eyebrow={
          <span className="flex items-center gap-2">
            <span aria-hidden className="text-sky-pale">
              {categoryIcon(category.name)}
            </span>
            {category.name} · {[business?.city, area.name].filter(Boolean).join(", ")}
          </span>
        }
        title={
          <>
            <BackLink href={backHref} className={`${BACK_PILL} -order-1 sm:hidden`}>
              <span aria-hidden>←</span> {backLabel}
            </BackLink>
            {/* On a phone the way back sits over the title instead. */}
            <Breadcrumbs crumbs={crumbs} className="max-sm:hidden" />
            <DisplayTitle className="break-words text-balance">{listing.title}</DisplayTitle>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sky-mist">
              <span className="grid size-8 shrink-0 place-items-center rounded-control border border-white/70 bg-trip-band text-xs font-extrabold text-white">
                {initials(listing.business.name)}
              </span>
              <span>
                by{" "}
                <Link href={businessHref} className="font-semibold text-white underline underline-offset-4" data-testid="listing-business">
                  {listing.business.name}
                </Link>
              </span>
              {business?.verified && (
                <span className={`${chip} text-mint`}>
                  <span aria-hidden>✓</span> Verified partner
                </span>
              )}
              {listing.instant_book ? <InstantBookBadge className="w-fit" /> : <span className={`${chip} text-white`}>Request to book</span>}
            </p>
          </>
        }
      >
        <BackLink href={backHref} className={`${BACK_PILL} max-sm:hidden`}>
          <span aria-hidden>←</span> {backLabel}
        </BackLink>
      </PageBanner>

      <PageSheet tone="paper">
        <ListingBody
          view={view}
          related={
            <RelatedListings
              cards={related}
              group={listing.group}
              place={from.name}
              allHref={bookHref(from.slug, { show: `need-${listing.group}`, datesQuery: tripDatesQuery(dates) })}
            />
          }
        />
      </PageSheet>
    </main>
  );
}

// How many other listings of its kind the page offers (RAA-237).
const RELATED = 6;

// The page's query again, for its redirect: `?place=…&from=place`, the trip and the dates.
function queryOf(searchParams: Record<string, string | string[] | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    for (const each of Array.isArray(value) ? value : value === undefined ? [] : [value]) query.append(key, each);
  }
  return query.size ? `?${query}` : "";
}

const BACK_PILL =
  "tap-target self-start whitespace-nowrap rounded-full border border-glass-edge bg-glass-fill px-4 py-2 text-sm font-semibold text-white hover:bg-glass-hover";
