import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getListing } from "@/api/discovery";
import { categoryIcon } from "@/components/discovery/icons";
import { InstantBookBadge } from "@/components/discovery/instant-book-badge";
import { ListingBody, listingId, loadListingView } from "@/components/discovery/listing-view";
import { CurrentPlace } from "@/components/landing/current-place";
import { PageBanner } from "@/components/landing/page-banner";
import { PageSheet } from "@/components/landing/page-sheet";
import { AdoptTrip } from "@/components/trips/trip-link";
import { BackLink } from "@/components/discovery/back-link";
import { DisplayTitle } from "@/components/ui/typography";

export async function generateMetadata(props: PageProps<"/listings/[id]">): Promise<Metadata> {
  const id = listingId((await props.params).id);
  const listing = id ? await getListing(id) : null;
  if (!listing) return { title: "Not found" };
  return { title: listing.title, description: listing.summary || undefined };
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
export default async function ListingPage(props: PageProps<"/listings/[id]">) {
  const id = listingId((await props.params).id);
  if (!id) notFound();
  const view = await loadListingView(id, await props.searchParams);
  if (!view) notFound();
  const { listing, business, from, tripId, backHref, backLabel, businessHref } = view;
  const { area, category } = listing;
  const chip = "inline-flex items-center gap-1 rounded-chip bg-glass-fill px-2.5 py-0.5 text-small font-semibold";

  return (
    <main className="flex flex-1 flex-col">
      <CurrentPlace name={from.name} slug={from.slug} />
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
        <ListingBody view={view} />
      </PageSheet>
    </main>
  );
}

const BACK_PILL =
  "tap-target self-start whitespace-nowrap rounded-full border border-glass-edge bg-glass-fill px-4 py-2 text-sm font-semibold text-white hover:bg-glass-hover";
