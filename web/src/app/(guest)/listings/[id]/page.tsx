import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getListing } from "@/api/discovery";
import { categoryIcon } from "@/components/discovery/icons";
import { PageBanner } from "@/components/landing/page-banner";
import { listingPhoto } from "@/components/landing/sample-photos";
import { AddToTripButton } from "@/components/trips/add-to-trip-button";
import { TripAddProvider } from "@/components/trips/trip-add-provider";
import { readTripDates, tripDatesQuery } from "@/components/trips/trip-dates";
import { TripDatesBar } from "@/components/trips/trip-dates-bar";
import { Card, CardBody } from "@/components/ui/card";
import { DisplayTitle, SectionTitle } from "@/components/ui/typography";

// Only a positive integer can be a listing id; anything else is a 404 without asking the API.
function listingId(param: string): number | null {
  return /^[1-9]\d{0,14}$/.test(param) ? Number(param) : null;
}

export async function generateMetadata(props: PageProps<"/listings/[id]">): Promise<Metadata> {
  const id = listingId((await props.params).id);
  const listing = id ? await getListing(id) : null;
  if (!listing) return { title: "Not found" };
  return { title: listing.title, description: listing.summary || undefined };
}

// One listing, for a traveller deciding whether to add it to a trip (RAA-90). Active listings
// only; it never shows the location. No price yet: pricing waits on checkout.
export default async function ListingPage(props: PageProps<"/listings/[id]">) {
  const id = listingId((await props.params).id);
  if (!id) notFound();
  const dates = readTripDates(await props.searchParams);
  const listing = await getListing(id);
  if (!listing) notFound();
  const { area, category } = listing;

  return (
    <main className="flex flex-1 flex-col">
      <PageBanner
        photo={listingPhoto(category.name, listing.id).src}
        preload
        eyebrow={
          <span className="flex items-center gap-2">
            <span aria-hidden className="text-sky-pale">
              {categoryIcon(category.name)}
            </span>
            {category.name} · {area.name}
          </span>
        }
        title={
          <>
            <DisplayTitle className="break-words">{listing.title}</DisplayTitle>
            <p className="text-sky-mist">
              by {listing.business.name} · {listing.units_label}
            </p>
          </>
        }
      >
        <Link
          href={`/${area.slug}${tripDatesQuery(dates)}#listing-${listing.id}`}
          className="self-start rounded-full border border-glass-edge bg-glass-fill px-4 py-2 text-sm font-semibold text-white hover:bg-glass-hover"
        >
          <span aria-hidden>←</span> {area.name}
        </Link>
      </PageBanner>

      <div className="mx-auto flex w-full max-w-narrow flex-col gap-block px-gutter py-page-pad">
      <TripAddProvider>
        {/* Unclipped: the dates calendar opens below the card's edge. */}
        <Card clip={false}>
          <CardBody pad="lg" className="flex flex-col gap-4">
            <TripDatesBar key={`${dates.from}-${dates.to}-${dates.guests}`} dates={dates} />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted">Saving to a trip is free, and there&apos;s nothing to pay yet.</p>
              <AddToTripButton listing={listing} dates={dates} />
            </div>
          </CardBody>
        </Card>
      </TripAddProvider>

      {listing.description.trim() && (
        <section className="flex flex-col gap-2">
          <SectionTitle>About this</SectionTitle>
          <p className="max-w-prose break-words whitespace-pre-line">{listing.description}</p>
        </section>
      )}
      </div>
    </main>
  );
}
