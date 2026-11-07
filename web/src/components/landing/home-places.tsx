import Image from "next/image";
import Link from "next/link";
import { getAreaPlaces } from "@/api/discovery";
import { SamplePhotoTag } from "@/components/discovery/photo-card";
import { PlaceScene } from "@/components/discovery/scenes";
import { ArrowGlyph, ChevronGlyph, CompassGlyph } from "@/components/discovery/tag-glyphs";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { LAUNCH_AREA } from "./launch-area";
import { isApiPhoto, landmarkPhotos } from "./sample-photos";

// How many places to see the row offers: three beside the Bantayan card from lg, more to swipe
// through below it.
const SHOWN = 6;
const WIDE = 3;

const AREA_HREF = `/${LAUNCH_AREA.slug}`;

// How many places a phone lists, one row each.
const LISTED = 3;

type LatLng = { lat: number; lng: number };

// The town a place is in: the launch area's town whose centre is nearest (the API names none).
function nearestTown(location: LatLng, towns: { name: string; center: LatLng }[]) {
  let best: string | null = null;
  let bestDistance = Infinity;
  for (const town of towns) {
    const distance = (town.center.lat - location.lat) ** 2 + (town.center.lng - location.lng) ** 2;
    if (distance < bestDistance) [best, bestDistance] = [town.name, distance];
  }
  return best;
}

// "Get to know Bantayan" (the team's E, 2026-11-06), with See all (the launch area's page). On a
// phone its first places to see as rows (a photo, the name, its town); from sm the launch area's
// card with Explore leads, then the places on photo cards. Each place opens its card on that page
// (`#slug`). The team's picks lead, then the places with a photo. From sm one row: a grid from lg,
// a swipe below it, running to the screen's edge. The places come from the API; if it fails the
// Bantayan card still shows.
export async function HomePlaces() {
  const area = await getAreaPlaces(LAUNCH_AREA.slug).catch((error: unknown) => {
    console.error(error);
    return null;
  });
  const landmarks = area?.landmarks ?? [];
  const photos = landmarkPhotos(landmarks);
  const places = landmarks
    .map((landmark, index) => ({ landmark, photo: photos[index], town: nearestTown(landmark.location, area?.areas ?? []) }))
    .sort((a, b) => Number(b.landmark.must_see) - Number(a.landmark.must_see) || Number(!!b.photo) - Number(!!a.photo))
    .slice(0, SHOWN);
  const tagline = area?.guide.tagline ?? "Beaches, towns and day trips";
  return (
    <section aria-labelledby="get-to-know" className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="get-to-know" className="font-display text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          Get to know {LAUNCH_AREA.name.replace(/ Island$/, "")}
        </h2>
        <Link
          href={AREA_HREF}
          className="flex min-h-11 items-center gap-1 text-control font-semibold text-action-ink transition-colors duration-300 ease-calm hover:text-action-hover"
        >
          See all
          <ChevronGlyph direction="right" className="size-4" />
        </Link>
      </div>
      <ul className="flex flex-col gap-2.5 sm:hidden">
        {places.slice(0, LISTED).map(({ landmark, photo, town }) => (
          <li key={landmark.slug}>
            <Link
              href={`${AREA_HREF}#${landmark.slug}`}
              data-testid="home-place"
              className="flex items-center gap-3.5 rounded-card border border-line bg-surface p-2.5 transition-[border-color,box-shadow] duration-300 ease-calm hover:border-line-strong hover:shadow-soft"
            >
              <span className="relative size-16 shrink-0 overflow-hidden rounded-control bg-navy">
                {photo ? (
                  <Image src={photo.src} alt={photo.alt} fill sizes="4rem" unoptimized={isApiPhoto(photo.src)} className="object-cover" />
                ) : (
                  <PlaceScene tags={landmark.tags} className="absolute inset-0 size-full" />
                )}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-lg font-semibold text-foreground">{landmark.name}</span>
                <span className="block truncate text-control text-muted">
                  {town ?? landmark.tags[0]?.name}
                  {photo && !isApiPhoto(photo.src) && " · Sample photo"}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <ul className="relative -mx-inset flex max-sm:hidden snap-x snap-mandatory gap-3.5 overflow-x-auto overscroll-x-contain scroll-px-inset px-inset [scrollbar-width:none] lg:mx-0 lg:grid lg:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))] lg:gap-4 lg:overflow-visible lg:px-0">
        <li className="w-80 shrink-0 snap-start lg:w-auto">
          <div className="flex h-52 flex-col justify-between gap-4 rounded-card border border-action-edge/25 bg-action-tint p-6">
            <div>
              <p className="font-display text-2xl font-bold tracking-tight text-action-ink">{LAUNCH_AREA.name}</p>
              <p className="mt-1.5 line-clamp-2 text-control text-action-ink/85">{tagline}</p>
            </div>
            <ButtonLink href={AREA_HREF} size="pill" className="self-start" data-testid="home-area-explore">
              <CompassGlyph className="size-5" />
              Explore
            </ButtonLink>
          </div>
        </li>
        {places.map(({ landmark, photo, town }, index) => (
          <li key={landmark.slug} className={cn("w-67 shrink-0 snap-start sm:w-60 lg:w-auto", index >= WIDE && "lg:hidden")}>
            <Link
              href={`${AREA_HREF}#${landmark.slug}`}
              data-testid="home-place"
              className="group relative isolate flex h-52 flex-col justify-end overflow-hidden rounded-card bg-navy p-4.5 text-white transition-[box-shadow,translate] duration-500 ease-calm hover:shadow-lift motion-safe:hover:-translate-y-1 lg:p-3"
            >
              {photo ? (
                <Image
                  src={photo.src}
                  alt={photo.alt}
                  fill
                  sizes="(min-width: 64rem) 15rem, 17rem"
                  unoptimized={isApiPhoto(photo.src)}
                  className="-z-20 object-cover"
                />
              ) : (
                <PlaceScene tags={landmark.tags} className="absolute inset-0 -z-20 size-full" />
              )}
              <div aria-hidden className="absolute inset-0 -z-10 bg-linear-to-t from-scrim/75 via-scrim/15 via-45% to-scrim/0" />
              {photo && !isApiPhoto(photo.src) && <SamplePhotoTag className="absolute top-3 left-3" />}
              <span className="flex items-center gap-1.5 text-xl font-bold lg:text-lg">
                <span className="min-w-0 truncate">{landmark.name}</span>
                <ArrowGlyph className="size-4 shrink-0 opacity-0 transition-opacity duration-300 ease-calm group-hover:opacity-100" />
              </span>
              <span className="truncate text-control text-white/90 lg:text-sm">{town ?? landmark.tags.slice(0, 2).map((tag) => tag.name).join(" · ")}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
