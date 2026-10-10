import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getListing } from "@/api/discovery";
import { categoryIcon } from "@/components/discovery/icons";
import { AddToTripButton } from "@/components/trips/add-to-trip-button";
import { TripAddProvider } from "@/components/trips/trip-add-provider";
import { readTripDates, tripDatesQuery } from "@/components/trips/trip-dates";
import { TripDatesBar } from "@/components/trips/trip-dates-bar";
import { Card, CardBody } from "@/components/ui/card";
import { DisplayTitle, Eyebrow, SectionTitle } from "@/components/ui/typography";

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
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-10">
      <Link
        href={`/${area.slug}${tripDatesQuery(dates)}#listing-${listing.id}`}
        className="self-start text-sm font-semibold text-link underline-offset-4 hover:underline"
      >
        <span aria-hidden>←</span> {area.name}
      </Link>

      <header className="flex flex-col gap-2">
        <Eyebrow>
          <span aria-hidden>{categoryIcon(category.name)}</span> {category.name} · {area.name}
        </Eyebrow>
        <DisplayTitle className="break-words">{listing.title}</DisplayTitle>
        <p className="text-muted">by {listing.partner_name}</p>
      </header>

      <TripAddProvider>
        <Card>
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
    </main>
  );
}
