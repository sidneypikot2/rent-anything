import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSharedTrip, type SharedTrip } from "@/api/shared-trips";
import { BookingStatusBadge } from "@/components/bookings/booking-status";
import { ListingCard } from "@/components/discovery/cards";
import { PageBanner } from "@/components/landing/page-banner";
import { PageSheet } from "@/components/landing/page-sheet";
import { formatDateRange, guestCount, itemCount } from "@/components/trips/format";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { DisplayTitle } from "@/components/ui/typography";

type SharedItem = SharedTrip["items"][number];

// The shared trip names a kind of thing, not the listing's own category, which it isn't sent:
// each picks the icon that holds the photo's place while it loads.
const KINDS: Record<SharedItem["booking_type"], { label: string; glyph: string }> = {
  stay: { label: "Stay", glyph: "Hotel or cottage" },
  activity: { label: "Tour or activity", glyph: "Tour" },
  rental: { label: "Rental", glyph: "Motorcycle" },
  transfer: { label: "Transfer", glyph: "Van transfer" },
};

export async function generateMetadata(props: PageProps<"/trips/shared/[token]">): Promise<Metadata> {
  const trip = await getSharedTrip((await props.params).token);
  return { title: trip ? trip.name : "Not found", robots: { index: false, follow: false } };
}

// A trip shared with a view-only link (RAA-178): its name, dates and guests, then each item
// with its photo, area, dates and booking status. No prices, no contact details and nothing to
// do but plan a trip of your own. An unknown, replaced or revoked link is not found.
export default async function SharedTripPage(props: PageProps<"/trips/shared/[token]">) {
  const trip = await getSharedTrip((await props.params).token);
  if (!trip) notFound();
  const cover = trip.items.find((item) => item.listing.cover_photo_url)?.listing;
  const firstArea = trip.items.at(0)?.area;

  return (
    <main className="flex flex-1 flex-col">
      <PageBanner
        photo={cover?.cover_photo_url ? { src: cover.cover_photo_url, alt: cover.title } : undefined}
        eyebrow="A trip shared with you"
        title={
          <>
            <DisplayTitle className="break-words" data-testid="shared-trip-name">
              {trip.name}
            </DisplayTitle>
            <p className="text-sky-mist">
              {[formatDateRange(trip.starts_on, trip.ends_on) ?? "No dates yet", guestCount(trip.guests), trip.destinations.join(", ")]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </>
        }
        search={false}
      >
        <ButtonLink href={firstArea ? `/${firstArea.slug}` : "/"} arrow className="self-start" data-testid="shared-trip-plan">
          Plan your own trip
        </ButtonLink>
      </PageBanner>

      <PageSheet>
        <div className="mx-auto flex w-full max-w-page flex-col gap-block px-gutter py-page-pad">
          {trip.items.length === 0 ? (
            <p className="text-white">Nothing in this trip yet.</p>
          ) : (
            <>
              <p className="text-sm text-sky-mist">{itemCount(trip.items.length)}</p>
              <ul className="grid gap-gutter sm:grid-cols-2 lg:grid-cols-3" data-testid="shared-trip-items">
                {trip.items.map((item, index) => (
                  // Items carry no id here, and the list never reorders.
                  <li key={index}>
                    <ListingCard
                      href={`/listings/${item.listing.id}`}
                      title={item.listing.title}
                      category={KINDS[item.booking_type].glyph}
                      kind={item.booking_type}
                      note={`${KINDS[item.booking_type].label} · ${item.area.name}`}
                      photo={
                        item.listing.cover_photo_url
                          ? { src: item.listing.cover_photo_url, alt: item.listing.title }
                          : undefined
                      }
                      sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                      rowOnPhone
                      unpriced={formatDateRange(item.starts_on, item.ends_on) ?? "No date yet"}
                      action={
                        item.booking_status ? (
                          <BookingStatusBadge status={item.booking_status} small />
                        ) : (
                          <Badge tone="mist" className="min-h-6 px-2.5 text-xs">
                            Planned
                          </Badge>
                        )
                      }
                    />
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </PageSheet>
    </main>
  );
}
