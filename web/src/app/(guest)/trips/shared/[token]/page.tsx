import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDestinations } from "@/api/discovery";
import { getSharedTrip, type SharedTrip } from "@/api/shared-trips";
import { BookingStatusBadge } from "@/components/bookings/booking-status";
import { ListingCard } from "@/components/discovery/cards";
import { GETTING_HERE } from "@/components/landing/launch-area";
import { PageBanner } from "@/components/landing/page-banner";
import { PageSheet } from "@/components/landing/page-sheet";
import { formatDateRange, guestCount, itemCount } from "@/components/trips/format";
import { PlanDays } from "@/components/trips/trip-plan-days";
import { tripPlan } from "@/components/trips/trip-plan";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
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

// A trip shared with a view-only link (RAA-178): its name, dates and guests, its plan day by
// day (the "Your plan" panel's PlanDays, read-only: no gaps or ideas, nothing to click) beside
// each item with its photo, area, dates and booking status. No prices, no contact details and
// nothing to do but plan a trip of your own. An unknown, replaced or revoked link is not found.
// An undated trip has no plan, only its items.
export default async function SharedTripPage(props: PageProps<"/trips/shared/[token]">) {
  const trip = await getSharedTrip((await props.params).token);
  if (!trip) notFound();
  const cover = trip.items.find((item) => item.listing.cover_photo_url)?.listing;
  const firstArea = trip.items.at(0)?.area;
  // Items carry no id here; the plan only needs one per item.
  const plan = tripPlan(
    { ...trip, items: trip.items.map((item, index) => ({ ...item, id: index, unavailable: null })) },
    [],
  );
  // Getting here is per destination (an island), and an item's area is its own place (Santa Fe):
  // the trip's destinations are named, so their slugs come from the destinations list.
  const destinationSlugs = plan
    ? (await getDestinations()).filter((area) => trip.destinations.includes(area.name)).map((area) => area.slug)
    : [];
  const gettingHere = destinationSlugs.map((slug) => GETTING_HERE[slug]).find(Boolean);

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
        <div className="mx-auto grid w-full max-w-page gap-gutter px-gutter py-page-pad lg:grid-cols-[24rem_minmax(0,1fr)] lg:items-start">
          {plan && (
            <Card className="lg:sticky lg:top-(--chrome)" data-testid="shared-trip-plan-card">
              <CardBody pad="lg" className="flex flex-col gap-4">
                <div>
                  <h2 className="font-display text-xl font-extrabold tracking-tight">Day by day</h2>
                  <p className="text-sm text-muted">
                    {plan.days.length} {plan.days.length === 1 ? "day" : "days"}
                  </p>
                </div>
                <PlanDays
                  plan={plan}
                  places={trip.items.map((item) => item.area.slug)}
                  gettingHere={gettingHere}
                />
              </CardBody>
            </Card>
          )}
          <div className={plan ? "flex min-w-0 flex-col gap-block" : "flex min-w-0 flex-col gap-block lg:col-span-2"}>
            {trip.items.length === 0 ? (
              <p className="text-white">Nothing in this trip yet.</p>
            ) : (
              <>
                <p className="text-sm text-sky-mist">{itemCount(trip.items.length)}</p>
                <ul
                  className={plan ? "grid gap-gutter sm:grid-cols-2" : "grid gap-gutter sm:grid-cols-2 lg:grid-cols-3"}
                  data-testid="shared-trip-items"
                >
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
        </div>
      </PageSheet>
    </main>
  );
}
