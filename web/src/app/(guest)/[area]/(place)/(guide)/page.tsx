import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAreaPlaces, getBookCards, getDestinations, getExplore, type PlanGroup } from "@/api/discovery";
import {
  datesSeason,
  gettingHereText,
  planHref,
  questionsAbout,
  sampleDays,
  bookHref,
  onIslandRoute,
  stayPlaces,
  typicalPrices,
  vibesOf,
} from "@/components/area/area-guide";
import { placesToSee } from "@/components/area/area-listings";
import { AreaNav, PlanFoot } from "@/components/area/area-nav";
import { AREA_NOTES, busyMonths } from "@/components/area/area-notes";
import {
  AreaBannerIntro,
  AreaGettingAround,
  AreaGettingHere,
  AreaGoodToKnow,
  AreaGuideSheet,
  AreaQuestions,
  AreaSampleDays,
  AreaStays,
  AreaThingsToDo,
  AreaWhenToGo,
} from "@/components/area/area-sections";
import type { RowCard } from "@/components/area/listing-row";
import { AreaMapProvider, MapHoverTarget } from "@/components/discovery/area-map-context";
import { placeKey } from "@/components/discovery/area-map-pins";
import { businessHref, titleCardHref, cardKey, descendants, isTitleCard, islandOf, listingByLine, listingPhotos, type BrowseListing } from "@/components/discovery/browse-offers";
import { TRIP_ORDER_GROUPS } from "@/components/discovery/categories";
import { LandmarkCard } from "@/components/discovery/cards";
import { ExploreSections, withoutShown } from "@/components/discovery/explore-sections";
import type { LandmarkTour } from "@/components/discovery/landmark-tours";
import { listingFeatures } from "@/components/discovery/listing-features";
import { PlacesGrid } from "@/components/discovery/places-grid";
import { AreaGlyph } from "@/components/discovery/tag-glyphs";
import { CurrentPlace } from "@/components/landing/current-place";
import { LAUNCH_AREA } from "@/components/landing/launch-area";
import { PageBanner } from "@/components/landing/page-banner";
import { PageSheet } from "@/components/landing/page-sheet";
import { areaPhoto, landmarkPhotos } from "@/components/landing/sample-photos";
import { addPreview } from "@/components/trips/add-preview";
import { guestsLabel } from "@/components/trips/format";
import { AreaHero } from "@/components/trips/area-hero";
import { ReachYourself } from "@/components/trips/reach-yourself";
import { GETTING_HERE } from "@/components/landing/launch-area";
import { AreaTripBand } from "@/components/trips/area-trip-band";
import { TripAddProvider } from "@/components/trips/trip-add-provider";
import { AdoptTrip, TripLinkProvider } from "@/components/trips/trip-link";
import { readTripDates, tripDatesQuery, tripParam } from "@/components/trips/trip-dates";
import { GlassPanel } from "@/components/ui/glass";
import { Section } from "@/components/ui/section";
import { DisplayTitle } from "@/components/ui/typography";
import { formatDateRange } from "@/lib/dates";
import { formatPeso } from "@/lib/money";
import { pricedByText, priceUnitText } from "@/lib/pricing";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbJsonLd, placeJsonLd } from "@/lib/json-ld";
import { areaCrumbs, canonical, metaDescription, openGraph } from "@/lib/seo";

type Listing = BrowseListing;
// The rows' groups, each fetched as What to book's first page (book_cards).
const ROW_GROUPS: PlanGroup[] = ["stay", "activity", "rental", "transfer"];
// A row's cards (area-sections' ROW_CARDS).
const ROW_SIZE = 10;

export async function generateMetadata(props: PageProps<"/[area]">): Promise<Metadata> {
  const detail = await getAreaPlaces((await props.params).area);
  if (!detail) return { title: "Not found" };
  const { area, groups, guide, landmarks, photos } = detail;
  // What a search result shows (Klook's "Singapore 2026: Top places to visit…"): the year and
  // what the page holds; the description the team's tagline, then what there is to book here
  // (RAA-229), so no two places share one.
  const year = new Date().getFullYear();
  const what = landmarks.length > 0 ? "places to see, stays and tours" : "stays, tours and transfers";
  const kinds = TRIP_ORDER_GROUPS.filter(({ group }) => groups[group].listings > 0).map(({ short }) => short.toLowerCase());
  const toBook = kinds.length > 0 ? `Book ${listText(kinds)} from local partners, in one cart.` : `Plan your trip, ${what}, in one cart.`;
  const lead = guide.tagline ?? `Plan a trip to ${area.name}${area.parent_name ? `, ${area.parent_name}` : ""}`;
  return {
    title: `${area.name} ${year}: ${what}`,
    description: metaDescription(`${lead.replace(/[.!]$/, "")}. ${toBook}`),
    // The place itself, without trip dates, a trip or a search (RAA-238).
    alternates: canonical(`/${area.slug}`),
    // Shared, its own banner photo once the team has added one, never a sample (RAA-233).
    openGraph: openGraph(`/${area.slug}`, photos[0] && { url: photos[0].large_url, alt: area.name }),
  };
}

// "a, b and c".
function listText(items: string[]) {
  return items.length > 1 ? `${items.slice(0, -1).join(", ")} and ${items.at(-1)}` : items[0];
}

// A destination: everything to book there, the places to see, and the destinations around
// it and often visited with it (RAA-58). Listings go into the guest's trips (RAA-66), with
// the trip dates and guests from the URL (no header search here: links and the trip set them). Since RAA-108 the banner
// shows the place's photo with its counts as chips. What to book comes first, on a paper
// sheet: a filter rail beside rows with their photos and what they include. It holds the
// places inside this one too (Santa Fe's on Bantayan Island's), each row naming its place, so
// the island's page is the whole island; their own pages are linked from the banner.
// The map is What to book's (its own page), not this one's.
export default async function AreaPage(props: PageProps<"/[area]">) {
  const slug = (await props.params).area;
  const searchParams = await props.searchParams;
  const dates = readTripDates(searchParams);
  const datesQuery = tripDatesQuery(dates);
  // Arrived from the home page's "Start your trip" (RAA-80).
  const starting = searchParams.start === "trip";
  // Back from a listing's or business's page that carried the trip (`?trip=`): that trip again.
  const tripId = tripParam(searchParams.trip);
  // A link from before What to book had its own page (2026-11-10) that asked for something to book
  // (`?show=` a group, `?q=` words): that page, with the same query.
  if (searchParams.show !== undefined || searchParams.q !== undefined) {
    const query = new URLSearchParams(
      Object.entries(searchParams).flatMap(([key, value]) =>
        (Array.isArray(value) ? value : value === undefined ? [] : [value]).map((each) => [key, each]),
      ),
    );
    redirect(`/${slug}/book?${query}`);
  }
  // The place without its listings, and each row's first cards from What to book's own pages
  // (book_cards), so a place with tens of thousands of listings loads as fast as one with ten.
  const [detail, explored, destinations, rowPages] = await Promise.all([
    getAreaPlaces(slug),
    // What's nearby: without it the page still has everything to book, and says so.
    getExplore({ area: slug, listings: "0" }).catch((error: unknown) => {
      console.error(error);
      return "failed" as const;
    }),
    // For the places inside this one and its island, so the page still renders without them.
    getDestinations().catch((error: unknown) => {
      console.error(error);
      return null;
    }),
    // A row without its cards still leaves the page.
    Promise.all(
      ROW_GROUPS.map((group) =>
        getBookCards(slug, group, group === "transfer" ? 18 : ROW_SIZE, undefined, undefined, undefined, 1, false).catch(
          (error: unknown) => {
            console.error(error);
            return null;
          },
        ),
      ),
    ),
  ]);
  if (!detail) notFound();
  const { area, areas, guide, groups } = detail;
  const listingCount = Object.values(groups).reduce((sum, group) => sum + group.listings, 0);
  // Each row's cards, as What to book groups them: a stay's per business, any other per title.
  const cardsOf = (group: PlanGroup): Listing[][] =>
    rowPages[ROW_GROUPS.indexOf(group)]?.cards.map((card) => card.listings) ?? [];
  const exploreFailed = explored === "failed";
  const explore = exploreFailed ? null : explored;
  // Its own photos once the team has added some (RAA-211), turning in the banner from the first;
  // until then a stand-in that suits its kind.
  const ownPhotos = detail.photos.map((photo, index) => ({
    src: photo.large_url,
    alt: detail.photos.length > 1 ? `${area.name}, photo ${index + 1} of ${detail.photos.length}` : area.name,
  }));
  const banner = ownPhotos[0] ?? areaPhoto(slug, area.kind);
  // What it offers, in the trip's order (the hero's lead).
  const offered = TRIP_ORDER_GROUPS.filter(({ group }) => groups[group].listings > 0).map(({ group }) => group);
  const landmarks = placesToSee(detail);
  // A place to see's photo: its own first one (RAA-211), else a stand-in that fits it, never one
  // another place or the banner has.
  const photos = landmarkPhotos(landmarks, [banner.src]);
  const byLine = (listing: Listing) => listingByLine(listing, slug);
  // The listings that visit each place to see, named by the API, and a few of them as rows.
  const visitsOf = (landmark: (typeof landmarks)[number]) =>
    landmark.visits.map((visit) => ({ ...visit, href: `/listings/${visit.id}${datesQuery}` }));
  const listingById = new Map(detail.visitor_rows.map((listing) => [listing.id, listing]));
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
  const photosOf = listingPhotos;
  // The same rows as What to book shows them, priced and with Add to trip.
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
  // Where the places to see are, for "about N km from your stay" on a place no tour goes to
  // (ReachYourself, which takes the stay's point from the trip).
  const landmarkPoints = new Map(
    (explore?.destinations ?? []).filter((place) => place.type === "landmark").map((place) => [place.slug, place.location]),
  );
  // Getting to know the place (RAA-252): what the team wrote and what the data shows, each part
  // left out when there is nothing for it, and Plan a trip, which plans the island a town is on.
  const planPlace = island ? (destinations?.find((each) => each.slug === island) ?? null) : null;
  const plan = {
    href: planHref(planPlace?.slug ?? slug, datesQuery),
    label: `Plan a trip to ${planPlace?.name ?? area.name}`,
  };
  // What no data holds yet, written by hand for the place (or, on a town's page, its island).
  const notes = AREA_NOTES[slug] ?? (island ? AREA_NOTES[island] : undefined);
  const gettingHere = gettingHereText(guide, GETTING_HERE[slug] ?? (island ? GETTING_HERE[island] : undefined));
  const rentals = groups.rental.businesses;
  const transfers = groups.transfer.businesses;
  const tours = groups.activity.businesses;
  const around = [
    rentals > 0 && {
      icon: "Motorcycle",
      label: "Scooters and cars",
      note: notes?.around?.rental ?? `From ${countText(rentals, "local partner")}.`,
      link: "Rent one",
      href: bookHref(slug, { show: "need-rental", datesQuery }),
    },
    transfers > 0 && {
      icon: "Van transfer",
      label: "Transfers",
      note: notes?.around?.transfer ?? `Port and airport rides from ${countText(transfers, "partner")}.`,
      link: "Find a transfer",
      href: bookHref(slug, { show: "need-transfer", datesQuery }),
    },
    tours > 0 && {
      icon: "Tour",
      label: "Tours",
      note: notes?.around?.activity ?? `${countText(tours, "partner")} run tours to the places to see.`,
      link: "See tours",
      href: bookHref(slug, { show: "need-activity", datesQuery }),
    },
  ].filter((way) => way !== false);
  const stays = stayPlaces(areas, landmarks);
  const ownStays = groups.stay.listings;
  // Where to stay's, Things to do's and Vehicle rental's cards, as What to book shows them (byCard):
  // a stay's per business (its name, what it sells), any other per listing title of a business
  // ("Mio 125", "by <business>"), with the lowest price, a stay's opening the business's page on
  // that group, a title card's its listing's page. Priced cards first, then those with a photo, as What to book
  // leads. `keep` narrows the group's listings first (Vehicle rental's on-island transfers).
  const rowCards = (group: PlanGroup, keep: (listing: Listing) => boolean = () => true): RowCard[] =>
    cardsOf(group)
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
          href: titled
            ? titleCardHref(offered, dates, slug, true)
            : businessHref(first.business.id, dates, `need-${group}`, slug),
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
  const stayCards = rowCards("stay");
  const activityCards = rowCards("activity");
  // Gear has no row or tab of its own: Things to do leads to it, the gear a guest needs going with
  // what they do (2026-11-09).
  const gearCount = groups.gear.listings;
  // Vehicle rental's row: the vehicles to rent here, then the transfers that run on the island
  // (onIslandRoute: both ends of the route on it). The rest of the transfers are getting there,
  // which Getting here's Find a transfer leads to (2026-11-09). With the row, Getting here's list
  // of ways around goes, its notes saying the row's intro instead.
  const islandPlaces = [
    planPlace?.name ?? area.name,
    ...(destinations ? descendants(destinations, island ?? slug).map((each) => each.name) : []),
    ...Object.values(notes?.towns ?? {}).map((town) => town.name),
    ...landmarks.map((landmark) => landmark.name),
  ];
  const isLocalTransfer = (listing: Listing) => onIslandRoute(listing.details.route, islandPlaces);
  // Among the transfers' first cards: enough to know whether vans run between the towns.
  const localTransfers = cardsOf("transfer").flat().filter(isLocalTransfer);
  const aroundCards = [...rowCards("rental"), ...rowCards("transfer", isLocalTransfer)];
  const aroundIntro =
    [
      rentals > 0 ? (notes?.around?.rental ?? `Scooters and cars from ${countText(rentals, "local partner")}.`) : null,
      localTransfers.length > 0 ? (notes?.around?.localTransfer ?? "Vans run between the towns too.") : null,
    ]
      .filter(Boolean)
      .join(" ") || null;
  const aroundLinks = [
    rentals > 0 && { label: "See rentals", href: bookHref(slug, { show: "need-rental", datesQuery }), testId: "area-around-rentals" },
    localTransfers.length > 0 && { label: "See transfers", href: bookHref(slug, { show: "need-transfer", datesQuery }), testId: "area-around-transfers" },
  ].filter((link) => link !== false);
  const days = sampleDays(landmarks, new Set(offered));
  const questions = questionsAbout({
    name: area.name,
    guide,
    gettingHere,
    stays,
    ownStays,
    rentals,
    transfers,
    landmarks,
    tours,
    extra: notes?.questions,
  });
  const year = Number((dates.from ?? new Date().toISOString()).slice(0, 4));
  const datesRange = formatDateRange(dates.from, dates.to);
  // The banner's quick facts: the place's own, else the best time to go when it is short, with
  // the typical prices from what is here after the first two (the way there, then the cost).
  const placeFacts =
    notes?.facts ??
    (guide.best_time_to_visit && guide.best_time_to_visit.length <= 24
      ? [{ label: "Best time", value: guide.best_time_to_visit }]
      : []);
  const facts = [...placeFacts.slice(0, 2), ...typicalPrices(detail.typical_prices), ...placeFacts.slice(2)];

  // The section bar names a few groups, not every part (Klook's has four): a group's tab goes to
  // its first part on the page, and stays marked through the rest of it. What to book has no tab
  // (2026-11-10): the rows' See all links and the banner lead go there.
  const hasWhen = Boolean(notes || guide.best_time_to_visit);
  // Getting here shows its list of ways around only without Vehicle rental's row (2026-11-09).
  const hasGettingHere = Boolean(gettingHere || (notes?.route.length ?? 0) > 0 || (aroundCards.length === 0 && around.length > 0));
  // Plan your visit runs from When to go through Vehicle rental, its last part.
  const planId = hasWhen ? "when" : hasGettingHere ? "getting-here" : aroundCards.length > 0 ? "around" : null;
  const tipsId = [(notes?.know.length ?? 0) > 0 && "know", days.length > 0 && "days", questions.length > 0 && "faq"].find(Boolean);
  const tabs = [
    landmarks.length > 0 && { id: "places", label: "Places to see" },
    planId && { id: planId, label: "Plan your visit" },
    ownStays > 0 && { id: "stay", label: "Stays" },
    activityCards.length > 0 && { id: "do", label: "Things to do" },
    tipsId && { id: tipsId, label: "Tips & questions" },
  ].filter((tab) => !!tab);

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
  const bannerTitle = (
    <>
      {areaTitle}
      <AreaBannerIntro tagline={guide.tagline} description={guide.description} goodFor={notes?.goodFor} vibes={vibesOf(landmarks)} facts={facts} />
    </>
  );

  return (
    <main className="flex flex-1 flex-col">
      <CurrentPlace name={area.name} slug={area.slug} />
      <JsonLd nodes={[placeJsonLd(detail), breadcrumbJsonLd(areaCrumbs(area))]} />
      {tripId && <AdoptTrip id={tripId} />}
      {listingCount > 0 ? (
        // The place's banner, with the guest's trip here at its foot.
        <AreaHero
          banner={{ photo: banner, carousel: ownPhotos, eyebrow, title: bannerTitle }}
          areaName={area.name}
          places={places}
          island={island}
          offered={offered}
          sights={landmarks.map((landmark) => ({ slug: landmark.slug, name: landmark.name, visitedBy: landmark.visited_by }))}
          starting={starting}
          plan={plan}
          book={bookHref(slug, { datesQuery })}
        />
      ) : (
        <PageBanner photo={banner} carousel={ownPhotos} eyebrow={eyebrow} title={bannerTitle} search={false} />
      )}

      <PageSheet tone="clear">
        <AreaMapProvider>
          {/* Listing and business links carry this place and the trip here (useTripHref). */}
          <TripLinkProvider place={area.slug} places={places}>
          <TripAddProvider places={places}>
            <div className="mx-auto w-full max-w-page">
              <div className="page-sections flex min-w-0 flex-col gap-section pt-block pb-page-pad">
                <AreaNav tabs={tabs} planHref={plan.href} />
                {landmarks.length > 0 && (
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
                                  <ReachYourself key={`reach-${landmark.slug}`} location={landmarkPoints.get(landmark.slug)!} places={places} />
                                )
                              }
                            />
                          </MapHoverTarget>
                        ),
                      }))}
                    />
                  </Section>
                )}
                <AreaGuideSheet>
                  <AreaWhenToGo
                    seasons={notes?.seasons ?? null}
                    busy={busyMonths(year)}
                    timing={notes?.timing ?? []}
                    bestTime={guide.best_time_to_visit}
                    yourDates={datesSeason(dates.from, notes?.seasons ?? null, datesRange)}
                  />
                  <AreaGettingHere
                    name={area.name}
                    route={notes?.route ?? []}
                    routeText={gettingHere}
                    routeSummary={notes?.routeSummary ?? null}
                    transferHref={transfers > 0 ? bookHref(slug, { show: "need-transfer", datesQuery }) : null}
                    around={aroundCards.length > 0 && (notes?.route?.length || gettingHere) ? [] : around}
                  />
                  <AreaGettingAround name={area.name} cards={aroundCards} intro={aroundIntro} links={aroundLinks} />
                  <AreaStays
                    name={area.name}
                    places={stays}
                    towns={notes?.towns}
                    stays={stayCards}
                    ownHref={bookHref(slug, { show: "need-stay", datesQuery })}
                  />
                  <AreaThingsToDo
                    name={area.name}
                    partners={tours}
                    activities={activityCards}
                    ownHref={bookHref(slug, { show: "need-activity", datesQuery })}
                    gear={gearCount}
                    gearHref={bookHref(slug, { show: "need-gear", datesQuery })}
                  />
                  <AreaGoodToKnow notes={notes?.know ?? []} />
                  <AreaSampleDays days={days} planHref={plan.href} planLabel={plan.label} />
                  <AreaQuestions name={area.name} questions={questions} />
                </AreaGuideSheet>

                {nearby && <ExploreSections explore={nearby} name={area.name} />}

                {exploreFailed && (
                  <p role="status" className="text-sm text-sky-mist">
                    The places around {area.name} couldn&apos;t load. Reload the page to try again.
                  </p>
                )}

                {/* The page ends on the trip, or with nothing in it yet, the two ways to fill it. */}
                <AreaTripBand
                  places={places}
                  place={planPlace?.name ?? area.name}
                  planHref={plan.href}
                  bookHref={listingCount > 0 ? bookHref(slug, { datesQuery }) : undefined}
                />
                <PlanFoot
                  href={plan.href}
                  place={planPlace?.name ?? area.name}
                  when={[datesRange ?? "Any dates", guestsLabel(dates.guests)].join(" · ")}
                  places={places}
                />

                {areas.length === 0 && landmarks.length === 0 && listingCount === 0 && !hasNearby && (
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
            </div>
          </TripAddProvider>
          </TripLinkProvider>
        </AreaMapProvider>
      </PageSheet>
    </main>
  );
}

function countText(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}
