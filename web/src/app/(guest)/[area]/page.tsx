import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getArea, getDestinations, getExplore, type AreaCard, type AreaDetail } from "@/api/discovery";
import { AreaMapProvider, MapHoverTarget, MapSwitch } from "@/components/discovery/area-map-context";
import { AreaMapLayout } from "@/components/discovery/area-map-layout";
import {
  listingPin,
  placeKey,
  placePins,
  type LandmarkInfo,
  type ListingPanelInfo,
} from "@/components/discovery/area-map-pins";
import { TRIP_ORDER_GROUPS } from "@/components/discovery/categories";
import { BusinessRow } from "@/components/discovery/business-row";
import { countLine, LandmarkCard, PHOTO_CARD, PHOTO_CARD_IMAGE } from "@/components/discovery/cards";
import { ExploreSections, withoutShown } from "@/components/discovery/explore-sections";
import { areaIcon } from "@/components/discovery/icons";
import { ListingBrowser } from "@/components/discovery/listing-browser";
import type { LandmarkTour } from "@/components/discovery/landmark-tours";
import { listingFeatures, type Feature } from "@/components/discovery/listing-features";
import { SectionOrder } from "@/components/discovery/section-order";
import { PlacesGrid } from "@/components/discovery/places-grid";
import { AreaGlyph, ArrowGlyph } from "@/components/discovery/tag-glyphs";
import { CurrentPlace } from "@/components/landing/current-place";
import { LAUNCH_AREA } from "@/components/landing/launch-area";
import { CHIP_ROW, PageBanner, STAT_CHIP, StatCount } from "@/components/landing/page-banner";
import { PageSheet } from "@/components/landing/page-sheet";
import { areaPhoto, landmarkPhotos } from "@/components/landing/sample-photos";
import { addPreview } from "@/components/trips/add-preview";
import { stayRules } from "@/components/trips/party";
import { AreaHero } from "@/components/trips/area-hero";
import { ReachYourself } from "@/components/trips/reach-yourself";
import { BOOKING_STATE, GETTING_HERE } from "@/components/landing/launch-area";
import { AddToTripButton } from "@/components/trips/add-to-trip-button";
import { AreaTripBand } from "@/components/trips/area-trip-band";
import { TripAddProvider } from "@/components/trips/trip-add-provider";
import { readTripDates, tripDatesQuery } from "@/components/trips/trip-dates";
import { GlassPanel, glassClasses } from "@/components/ui/glass";
import { cn } from "@/components/ui/cn";
import { Section } from "@/components/ui/section";
import { DisplayTitle } from "@/components/ui/typography";
import { formatPeso } from "@/lib/money";
import { pricedByNote, pricedByText, priceUnitText } from "@/lib/pricing";
import { groupText, guestTourTypeLabel } from "@/lib/tours";

type Listing = AreaDetail["listings"][number];

// Listings grouped by what the trip needs (SPEC: the area home groups by trip need), which
// What to book's filter offers (RAA-125), in TRIP_ORDER_GROUPS' order (a group the trip already has here moves to the end).
// Each group keeps its anchor, and an icon for the rail.
const TRIP_NEEDS = TRIP_ORDER_GROUPS.map(({ group, id, title, icon, need }) => ({
  title,
  id,
  icon,
  need,
  group: group satisfies Listing["group"],
}));

export async function generateMetadata(props: PageProps<"/[area]">): Promise<Metadata> {
  const detail = await getArea((await props.params).area);
  return { title: detail ? detail.area.name : "Not found" };
}

// A destination: everything to book there, the places to see, and the destinations around
// it and often visited with it (RAA-58). Listings go into the guest's trips (RAA-66), with
// the trip dates and guests from the URL, which the header's search sets. Since RAA-108 the banner
// shows the place's photo with its counts as chips. What to book comes first, on a paper
// sheet: a filter rail beside rows with their photos and what they include. It holds the
// places inside this one too (Santa Fe's on Bantayan Island's), each row naming its place, so
// the island's page is the whole island; their own pages are linked from the banner.
// A map of its listings and places to see sits beside the sections from lg (full screen from a
// Map button on a phone), its pins from the explore response, which also covers the places
// inside this one.
export default async function AreaPage(props: PageProps<"/[area]">) {
  const slug = (await props.params).area;
  const searchParams = await props.searchParams;
  const dates = readTripDates(searchParams);
  const datesQuery = tripDatesQuery(dates);
  // Arrived from the home page's "Start your trip" (RAA-80).
  const starting = searchParams.start === "trip";
  // Arrived from one of the home hero's category pills (RAA-130): What to book opens on that group;
  // one this place doesn't have opens on All.
  const show = typeof searchParams.show === "string" ? searchParams.show : undefined;
  // Words typed in the header's search on this page: What to book narrows to them (ListingBrowser).
  const q = typeof searchParams.q === "string" && searchParams.q.trim() ? searchParams.q.trim() : undefined;
  // A search for something to book (a category, words) puts What to book first; otherwise the
  // trip shown here decides (SectionOrder).
  const asked = Boolean(show || q);
  const [detail, explored, destinations] = await Promise.all([
    getArea(slug),
    // The map and what's nearby: without them the page still has everything to book, and says so.
    getExplore({ area: slug }).catch((error: unknown) => {
      console.error(error);
      return "failed" as const;
    }),
    // Only for the counts, so the page still renders without them.
    getDestinations().catch((error: unknown) => {
      console.error(error);
      return null;
    }),
  ]);
  if (!detail) notFound();
  const { area, areas, listings } = detail;
  const exploreFailed = explored === "failed";
  const explore = exploreFailed ? null : explored;
  // The places tours go to first: they are the ones a trip can reach from this page.
  const landmarks = [...detail.landmarks].sort((a, b) => b.visited_by.length - a.visited_by.length);
  const banner = areaPhoto(slug, area.kind);
  const counts = destinations ? areaCounts(destinations, slug) : null;
  // Nearby places that aren't on this page or inside this place (its landmarks, the places
  // inside it, however deep, and their landmarks).
  const inside = new Set([
    ...areas.map((child) => child.slug),
    ...(destinations ? descendants(destinations, slug).map((child) => child.slug) : []),
  ]);
  const nearby = explore && withoutShown(explore, { landmarks, areas: inside });
  const hasNearby = Boolean(nearby && (nearby.destinations.length > 0 || nearby.recommendations.length > 0));
  // This place and every place inside it: what the trip has "here".
  const places = [slug, ...inside];
  // The island this place is a town of (its top-most destination), when it is one: a transfer or
  // a scooter anywhere on it covers this page too.
  const island = destinations ? islandOf(destinations, slug) : null;
  const needs = TRIP_NEEDS.map((need) => ({
    ...need,
    // One row per business (the team's business-first list), with its listings in this group;
    // businesses with a price first, so a section opens on what can be compared.
    businesses: byBusiness(
      listings
        .filter((listing) => listing.group === need.group)
        .sort((a, b) => Number(!a.price_from_cents) - Number(!b.price_from_cents)),
    ),
  })).filter((need) => need.businesses.length > 0);
  // "by Santa Fe Boats · in Santa Fe · 2 vans": the place only for a row from a place inside this
  // one, and the units only when they say there is more than one to pick from — not for a tour,
  // nor a single one ("1 van"), nor in the category's fallback words ("2 units").
  const byLine = (listing: Listing) =>
    [
      `by ${listing.business.name}`,
      listing.area_slug !== slug && `in ${listing.area_name}`,
      listing.booking_type !== "activity" &&
        !/\bunits?$/.test(listing.units_label) &&
        !/^1\s/.test(listing.units_label) &&
        listing.units_label,
    ]
      .filter(Boolean)
      .join(" · ");
  // A place to see's photo: a stand-in that fits it, never one another place or the banner has
  // (landmarkPhotos).
  const photos = landmarkPhotos(landmarks, [banner.src]);
  // The rows on this page that visit each place to see.
  const listingById = new Map(listings.map((listing) => [listing.id, listing]));
  const visitsOf = (landmark: (typeof landmarks)[number]) =>
    landmark.visited_by.flatMap((id) => {
      const listing = listingById.get(id);
      return listing
        ? [{ id, title: listing.title, href: `/listings/${id}${datesQuery}`, category: listing.category }]
        : [];
    });
  // A listing's own photos (its cover alone while the area API sends no others), or none: its
  // category icon then shows, never a stand-in photo.
  const photosOf = (listing: Listing) =>
    listing.photos.length > 0
      ? listing.photos.map((photo) => ({ src: photo.card_url, alt: listing.title }))
      : listing.cover_photo_url
        ? [{ src: listing.cover_photo_url, alt: listing.title }]
        : [];
  // Its chips, led by a tour's kind and the group it takes ("Shared tour · 2 to 12 guests"), so
  // the row says it before the panel does.
  const featuresOf = (listing: Listing): Feature[] => {
    const tour = listing.tour;
    const kind = tour && `${guestTourTypeLabel(tour.tour_type)} · ${groupText(tour.min_guests, tour.max_guests)}`;
    return [...(kind ? [{ icon: "guests", label: kind }] : []), ...listingFeatures(listing)];
  };
  // The same rows as the place's tour list shows them, priced and with Add to trip as in What to book.
  const toursOf = (landmark: (typeof landmarks)[number]): LandmarkTour[] =>
    landmark.visited_by.flatMap((id) => {
      const listing = listingById.get(id);
      if (!listing) return [];
      const priceUnit = listing.price_from_cents ? priceUnitText(listing.price_unit) : null;
      return [
        {
          id,
          title: listing.title,
          by: byLine(listing),
          category: listing.category,
          photo: photosOf(listing)[0] ?? null,
          price: listing.price_from_cents
            ? { prefix: "from", amount: formatPeso(listing.price_from_cents), unit: priceUnit ?? undefined }
            : undefined,
          unpriced: pricedByText(listing.booking_type),
          listing: { id: listing.id, title: listing.title, booking_type: listing.booking_type },
          preview: addPreview(listing, byLine(listing)),
        },
      ];
    });
  // The map's pins, reusing what the rows and cards show, so a pin's pop-up and panel match.
  const rowInfo = new Map<number, ListingPanelInfo>(
    needs.flatMap((need) =>
      need.businesses.flat().map((listing) => [
        listing.id,
        {
          by: byLine(listing),
          place: listing.area_name,
          summary: listing.summary,
          features: featuresOf(listing),
          photo: photosOf(listing)[0] ?? null,
          add: addPreview(listing, byLine(listing)),
        },
      ]),
    ),
  );
  const landmarkInfo = new Map<string, LandmarkInfo>(
    landmarks.map((landmark, index) => [
      landmark.slug,
      { description: landmark.description, tags: landmark.tags, photo: photos[index], visits: visitsOf(landmark) },
    ]),
  );
  // Where the places to see and the stays are, for "about N km from your stay" on a place no tour
  // goes to (ReachYourself).
  const landmarkPoints = new Map(
    (explore?.destinations ?? []).filter((place) => place.type === "landmark").map((place) => [place.slug, place.location]),
  );
  const stayPoints = Object.fromEntries(
    (explore?.listings ?? []).filter((listing) => listing.booking_type === "stay").map((listing) => [listing.id, listing.location]),
  );
  const pins = explore
    ? [
        ...explore.listings.map((listing) => listingPin(listing, rowInfo.get(listing.id))),
        ...placePins(explore.destinations, landmarkInfo),
      ]
    : [];
  const map =
    explore && pins.length > 0
      ? {
          pins,
          center: explore.anchor.location,
          dates,
          datesQuery,
          areaName: area.name,
          landmarks: Object.fromEntries(landmarkInfo),
        }
      : null;
  // The banner's counts link down to their sections, so the places to see are a tap away on a
  // phone, however long What to book is. "To book" counts What to book's cards (one per partner
  // per section), the same as its All, so the two numbers agree.
  const cards = needs.reduce((sum, need) => sum + need.businesses.length, 0);
  const stats = [
    listings.length > 0 && { count: cards, label: "to book", href: "#listings" },
    landmarks.length > 0 && {
      count: landmarks.length,
      label: landmarks.length === 1 ? "place to see" : "places to see",
      href: "#places",
    },
  ].filter((stat) => stat !== false);
  // What to book's intro names the partners the rail's cards stand for (one card per partner per
  // section, so the rail's All and the banner count cards).
  const partners = new Set(listings.map((listing) => listing.business.id)).size;
  // A single place inside with things to book is already the banner's "5 in Santa Fe" chip, so
  // it gets no section of its own repeating it.
  const insideShown = !(areas.length === 1 && counts?.more.some((child) => child.area.slug === areas[0].slug));

  const eyebrow = area.parent_name ? `${area.parent_name}, Philippines` : "Philippines";
  const areaTitle = (
    // The name keeps at least 12rem beside its icon; at a large text size (rem grows with
    // it) that no longer fits on a phone, and the icon goes above the name instead.
    <DisplayTitle className="flex flex-wrap items-center gap-x-4 gap-y-3">
      <GlassPanel aria-hidden className="flex size-12 shrink-0 items-center justify-center rounded-control sm:size-14">
        <AreaGlyph kind={area.kind} className="size-6 text-sky-pale sm:size-7" />
      </GlassPanel>
      <span className="min-w-0 flex-1 basis-48">{area.name}</span>
    </DisplayTitle>
  );
  // The banner's chips: its counts, linking down to their sections, and the places inside this
  // one with things to book, which the total counts, linked to their own pages (RAA-85).
  const statChips = stats.map((stat) => (
    <li key={stat.label} className="shrink-0">
      <a href={stat.href} className={cn(STAT_CHIP, glassClasses(), "hover:bg-glass-hover")}>
        <StatCount count={stat.count} /> {stat.label}
        {/* Down the page, as the places inside go to their own pages (→). */}
        <ArrowGlyph direction="down" className="size-4 text-sky-pale" />
      </a>
    </li>
  ));
  // Counted as cards too, so "5 in Santa Fe" matches "10 to book" and Santa Fe's own page.
  const cardsIn = (slugs: Set<string>) =>
    new Set(listings.filter((listing) => slugs.has(listing.area_slug)).map((listing) => `${listing.business.id}:${listing.group}`)).size;
  const placeLinks = (counts?.more ?? []).map((child) => ({
    href: `/${child.area.slug}${datesQuery}`,
    name: child.area.name,
    count: cardsIn(new Set([child.area.slug, ...descendants(destinations ?? [], child.area.slug).map((each) => each.slug)])),
  }));

  return (
    <main className="flex flex-1 flex-col">
      <CurrentPlace name={area.name} slug={area.slug} />
      {listings.length > 0 ? (
        // The place's banner, with the guest's trip here at its foot.
        <AreaHero
          banner={{ photo: banner, eyebrow, title: areaTitle }}
          statChips={statChips}
          placeLinks={placeLinks}
          areaName={area.name}
          places={places}
          island={island}
          offered={needs.map((need) => need.group)}
          sights={landmarks.map((landmark) => ({ slug: landmark.slug, name: landmark.name, visitedBy: landmark.visited_by }))}
          starting={starting}
        />
      ) : (
        <PageBanner photo={banner} eyebrow={eyebrow} title={areaTitle}>
          {(stats.length > 0 || placeLinks.length > 0) && (
            <ul aria-label={`In ${area.name}`} className={CHIP_ROW}>
              {statChips}
              {placeLinks.map((link) => (
                <li key={link.href} className="shrink-0">
                  <Link href={link.href} className={cn(STAT_CHIP, glassClasses(), "hover:bg-glass-hover")}>
                    <StatCount count={link.count} /> in {link.name}
                    <span aria-hidden className="text-sky-pale">
                      →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </PageBanner>
      )}

      <PageSheet tone="clear">
        <AreaMapProvider>
          <TripAddProvider places={places}>
            <AreaMapLayout map={map}>
              <div className="page-sections flex min-w-0 flex-col gap-section pt-block pb-page-pad">
                {/* What to book's rail holds the map's switch; without it the switch leads the page. */}
                {listings.length === 0 && map && (
                  <div className="hidden max-w-xs lg:block">
                    <MapSwitch />
                  </div>
                )}
                <SectionOrder
                  asked={asked}
                  tripPlaces={places}
                  places={
                    landmarks.length > 0 && (
                      <Section
                        id="places"
                        surface="photo"
                        title="Places to see"
                        intro="Open one to see which tours go there."
                      >
                        <PlacesGrid
                          items={landmarks.map((landmark, index) => ({
                            id: landmark.slug,
                            card: (
                              <MapHoverTarget pin={placeKey(landmark.slug)}>
                                <LandmarkCard
                                  landmark={landmark}
                                  photo={photos[index]}
                                  visits={visitsOf(landmark)}
                                  tours={toursOf(landmark)}
                                  dates={dates}
                                  areaName={area.name}
                                  reach={
                                    landmarkPoints.has(landmark.slug) && (
                                      <ReachYourself location={landmarkPoints.get(landmark.slug)!} places={places} stays={stayPoints} />
                                    )
                                  }
                                />
                              </MapHoverTarget>
                            ),
                          }))}
                        />
                      </Section>
                    )
                  }
                  listings={
                    listings.length > 0 && (
                      <Section
                        id="listings"
                        surface="paper"
                        title="What to book"
                        intro={`From ${countText(partners, "local partner")}: tours, transfers, rentals and stays. Saving to a trip is free; ${BOOKING_STATE.unpaid}.`}
                      >
                        <ListingBrowser
                          initial={show}
                          query={q}
                          placeName={area.name}
                          clearHref={`/${slug}${datesQuery}`}
                          tripPlaces={places}
                          tripIsland={island}
                          empty={<p className="text-muted">Nothing here yet.</p>}
                          groups={needs.map((need) => {
                            const shared = sharedChipsOf(need.businesses);
                            const unpricedNote = need.businesses
                              .flat()
                              .map((listing) => !listing.price_from_cents && pricedByNote(listing.booking_type))
                              .find(Boolean);
                            return {
                            id: need.id,
                            title: need.title,
                            icon: need.icon,
                            group: need.group,
                            // Said once here rather than on every card: what they all include, and
                            // how the unpriced ones are priced. Transfers also say how a traveller
                            // reaches the place at all (the trip plan's Getting here).
                            gettingHere: need.group === "transfer" ? GETTING_HERE[slug] : undefined,
                            shared,
                            note: unpricedNote || undefined,
                            items: need.businesses.map((offered) => {
                              const offers = offered.map((listing) => {
                                const priceUnit = listing.price_from_cents ? priceUnitText(listing.price_unit) : null;
                                return {
                                  listingId: listing.id,
                                  text: [listing.title, listing.category, listing.business.name, listing.area_name, listing.summary, need.title]
                                    .filter(Boolean)
                                    .join(" "),
                                  href: `/listings/${listing.id}${datesQuery}`,
                                  title: listing.title,
                                  category: listing.category,
                                  by: byLine(listing),
                                  summary: listing.summary,
                                  photos: photosOf(listing),
                                  features: featuresOf(listing),
                                  priceCents: listing.price_from_cents ?? null,
                                  priceUnit,
                                  price: listing.price_from_cents
                                    ? {
                                        prefix: "from",
                                        amount: formatPeso(listing.price_from_cents),
                                        unit: priceUnit ?? undefined,
                                      }
                                    : undefined,
                                  unpriced: pricedByText(listing.booking_type),
                                  instantBook: listing.instant_book,
                                  place: listing.area_name,
                                  handover: listing.handover,
                                  stay:
                                    listing.booking_type === "stay"
                                      ? {
                                          listingId: listing.id,
                                          title: listing.title,
                                          priceText: listing.price_from_cents
                                            ? ["from", formatPeso(listing.price_from_cents), priceUnit].filter(Boolean).join(" ")
                                            : undefined,
                                          rules: stayRules(listing.details, listing.units_count),
                                          preview: addPreview(listing, byLine(listing)),
                                        }
                                      : undefined,
                                  action: (
                                    <AddToTripButton
                                      listing={listing}
                                      dates={dates}
                                      preview={addPreview(listing, byLine(listing))}
                                    />
                                  ),
                                  panelAction: (
                                    <AddToTripButton
                                      listing={listing}
                                      dates={dates}
                                      preview={addPreview(listing, byLine(listing))}
                                    />
                                  ),
                                };
                              });
                              const first = offered[0];
                              // Its place, when all its listings here are in one place inside this one.
                              const place =
                                offered.every((listing) => listing.area_slug === first.area_slug) &&
                                first.area_slug !== slug
                                  ? `in ${first.area_name}`
                                  : undefined;
                              return {
                                key: `${need.id}-business-${first.business.id}`,
                                offers: offers.map(({ listingId, priceCents, priceUnit, features, text }) => ({
                                  id: listingId,
                                  priceCents,
                                  priceUnit,
                                  features,
                                  text,
                                })),
                                content: (
                                  <BusinessRow
                                    name={first.business.name}
                                    place={place}
                                    groupTitle={need.title}
                                    offers={offers}
                                    dates={dates}
                                    sharedChips={shared}
                                    // A shop of rental vehicles picks how many of each in its panel (RAA-191).
                                    shop={
                                      offered.every(
                                        (listing) =>
                                          listing.booking_type === "rental" && listing.group !== "gear" && typeof listing.details?.seats === "number",
                                      )
                                        ? { businessId: first.business.id }
                                        : undefined
                                    }
                                  />
                                ),
                              };
                            }),
                            };
                          })}
                        />
                      </Section>
                    )
                  }
                />

                {areas.length > 0 && insideShown && (
                  <Section id="inside" surface="photo" title={`Destinations in ${area.name}`}>
                    {/* One place inside gets the whole row, as a shorter card, rather than half a row. */}
                    <ul className={cn("grid gap-gutter", areas.length > 1 && "sm:grid-cols-2")}>
                      {areas.map((child) => {
                        const childCount = counts?.children.get(child.slug);
                        const photo = areaPhoto(child.slug, child.kind);
                        return (
                          <li key={child.slug}>
                            <Link
                              href={`/${child.slug}`}
                              className={cn(
                                "group flex items-end p-3",
                                areas.length > 1 ? "min-h-48" : "min-h-40",
                                PHOTO_CARD,
                              )}
                            >
                              <Image
                                src={photo.src}
                                alt={photo.alt}
                                fill
                                sizes={
                                  areas.length > 1
                                    ? "(min-width: 640px) 50vw, 100vw"
                                    : "(min-width: 72rem) 72rem, 100vw"
                                }
                                className={PHOTO_CARD_IMAGE}
                              />
                              <span
                                aria-hidden
                                className="absolute inset-0 -z-10 bg-linear-to-b from-transparent to-scrim/55"
                              />
                              <GlassPanel
                                tone="card"
                                className={cn(
                                  "flex items-center gap-3 rounded-button p-3",
                                  areas.length > 1 ? "w-full" : "w-full sm:w-auto sm:pr-6",
                                )}
                              >
                                <span
                                  aria-hidden
                                  className="flex size-9 shrink-0 items-center justify-center rounded-control border border-glass-edge bg-glass-fill text-lg"
                                >
                                  {areaIcon(child.kind)}
                                </span>
                                <span className="min-w-0">
                                  <span className="block font-semibold">{child.name}</span>
                                  {childCount && <span className="block text-sm text-sky-mist">{childCount}</span>}
                                </span>
                              </GlassPanel>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </Section>
                )}

                {nearby && <ExploreSections explore={nearby} name={area.name} />}

                {exploreFailed && (
                  <p role="status" className="text-sm text-sky-mist">
                    The map and the places around {area.name} couldn&apos;t load. Reload the page to try again.
                  </p>
                )}

                {/* The page ends on the trip, which What to book fills. */}
                {listings.length > 0 && <AreaTripBand areaName={area.name} places={places} />}

                {areas.length === 0 && landmarks.length === 0 && listings.length === 0 && !hasNearby && (
                  <p className="text-muted">
                    Nothing here yet. Local partners are still being added.
                    {slug !== LAUNCH_AREA.slug && (
                      <>
                        {" "}
                        <Link
                          href={`/${LAUNCH_AREA.slug}${datesQuery}`}
                          className="font-semibold text-link underline-offset-4 hover:underline"
                        >
                          See what to book on {LAUNCH_AREA.name}
                        </Link>
                      </>
                    )}
                  </p>
                )}
              </div>
            </AreaMapLayout>
          </TripAddProvider>
        </AreaMapProvider>
      </PageSheet>
    </main>
  );
}

// The chips every listing in a group has, when it holds more than one business (one card has
// nothing to repeat): its note says them once.
function sharedChipsOf(businesses: Listing[][]) {
  const all = businesses.flat();
  if (businesses.length < 2) return [];
  const labels = (listing: Listing) => listingFeatures(listing).map((feature) => feature.label);
  return labels(all[0]).filter((label) => all.every((listing) => labels(listing).includes(label)));
}

function countText(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

// The counts for the places inside this one (RAA-80): each card's own line, and the ones
// with things to book, which the banner links to as "5 in Santa Fe" (RAA-85). A place's
// count includes the places inside it, as its home card's does, and as this page's total does.
function areaCounts(destinations: AreaCard[], slug: string) {
  const inside = destinations.filter((child) => child.parent_slug === slug);
  return {
    children: new Map(inside.map((child) => [child.slug, countLine(child)])),
    more: inside
      .map((child) => ({
        area: child,
        toBook: child.to_book_count,
      }))
      .filter(({ toBook }) => toBook > 0),
  };
}

// Listings by their business, each business where its first listing is, the order kept.
function byBusiness<T extends { business: { id: number } }>(rows: T[]): T[][] {
  const groups = new Map<number, T[]>();
  for (const row of rows) groups.set(row.business.id, [...(groups.get(row.business.id) ?? []), row]);
  return [...groups.values()];
}

// Every listed place inside this one, however deep.
// The top-most destination above a place, when the place sits inside one (Santa Fe's Bantayan
// Island): what a trip item's `destination` names. A province above it (Cebu) isn't a
// destination, so it stops there; null for a top-most place itself.
function islandOf(destinations: AreaCard[], slug: string) {
  const bySlug = new Map(destinations.map((each) => [each.slug, each]));
  const seen = new Set([slug]);
  let top: string | null = null;
  let parent = bySlug.get(slug)?.parent_slug ?? null;
  while (parent && bySlug.has(parent) && !seen.has(parent)) {
    seen.add(parent);
    top = parent;
    parent = bySlug.get(parent)?.parent_slug ?? null;
  }
  return top;
}

function descendants(destinations: AreaCard[], slug: string, seen = new Set([slug])): AreaCard[] {
  return destinations
    .filter((child) => child.parent_slug === slug && !seen.has(child.slug))
    .flatMap((child) => {
      seen.add(child.slug);
      return [child, ...descendants(destinations, child.slug, seen)];
    });
}
