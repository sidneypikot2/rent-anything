import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getArea, getExplore, type AreaDetail } from "@/api/discovery";
import { ExploreSections } from "@/components/discovery/explore-sections";
import { areaIcon, tagIcon } from "@/components/discovery/icons";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardLink } from "@/components/ui/card";
import { DisplayTitle, Eyebrow, SectionTitle } from "@/components/ui/typography";

type Listing = AreaDetail["listings"][number];

// Listings grouped by what the trip needs (SPEC: the area home groups by trip need).
const TRIP_NEEDS: { title: string; bookingTypes: Listing["booking_type"][] }[] = [
  { title: "Tours & activities", bookingTypes: ["activity"] },
  { title: "Getting there & around", bookingTypes: ["transfer"] },
  { title: "Rentals & gear", bookingTypes: ["rental"] },
  { title: "Stays", bookingTypes: ["stay"] },
];

export async function generateMetadata(props: PageProps<"/[area]">): Promise<Metadata> {
  const detail = await getArea((await props.params).area);
  return { title: detail ? detail.area.name : "Not found" };
}

// A destination: the places to see there, everything to book, and the destinations around
// it and often visited with it (RAA-58). Booking comes later (M3).
export default async function AreaPage(props: PageProps<"/[area]">) {
  const slug = (await props.params).area;
  const [detail, explore] = await Promise.all([getArea(slug), getExplore({ area: slug })]);
  if (!detail) notFound();
  const { area, areas, landmarks, listings } = detail;

  return (
    <main className="flex flex-1 flex-col">
      <section className="border-b border-line bg-linear-to-br from-mist to-sage px-4 py-12">
        <div className="mx-auto flex max-w-5xl flex-col gap-3">
          <Eyebrow>{area.parent_name ? `${area.parent_name}, Philippines` : "Philippines"}</Eyebrow>
          <DisplayTitle>
            <span aria-hidden>{areaIcon(area.kind)}</span> {area.name}
          </DisplayTitle>
          <p className="text-muted">
            {landmarks.length} places to see · {listings.length} things to book
          </p>
        </div>
      </section>

      <div className="mx-auto flex w-full max-w-5xl flex-col gap-12 px-4 py-10">
        {areas.length > 0 && (
          <section className="flex flex-col gap-3">
            <SectionTitle>Destinations in {area.name}</SectionTitle>
            <ul className="grid gap-2 sm:grid-cols-2">
              {areas.map((child) => (
                <li key={child.slug}>
                  <CardLink href={`/${child.slug}`} className="flex items-center gap-3 p-4 font-semibold">
                    <span aria-hidden className="text-2xl">
                      {areaIcon(child.kind)}
                    </span>
                    {child.name}
                  </CardLink>
                </li>
              ))}
            </ul>
          </section>
        )}

        {landmarks.length > 0 && (
          <section className="flex flex-col gap-3">
            <SectionTitle>Places to see</SectionTitle>
            <div className="grid gap-3 sm:grid-cols-2">
              {landmarks.map((landmark) => (
                <Card key={landmark.slug} id={landmark.slug} data-testid="landmark" className="scroll-mt-6">
                  <CardBody className="flex flex-col gap-2">
                    <h3 className="font-semibold">📍 {landmark.name}</h3>
                    <p className="text-sm text-muted">{landmark.description}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {landmark.tags.map((tag) => (
                        <Badge key={tag.slug} tone="mist">
                          {tagIcon(tag.slug)} {tag.name}
                        </Badge>
                      ))}
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
          </section>
        )}

        {listings.length > 0 && (
          <section id="listings" className="flex scroll-mt-6 flex-col gap-6">
            <SectionTitle>What to book</SectionTitle>
            {TRIP_NEEDS.map((need) => {
              const group = listings.filter((listing) => need.bookingTypes.includes(listing.booking_type));
              if (group.length === 0) return null;
              return (
                <div key={need.title} className="flex flex-col gap-2">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-muted">{need.title}</h3>
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {group.map((listing) => (
                      <li key={listing.id}>
                        <Card>
                          <CardBody className="flex items-center justify-between gap-3">
                            <span className="min-w-0">
                              <span className="block font-semibold">{listing.title}</span>
                              <span className="block text-sm text-muted">{listing.category}</span>
                            </span>
                            <Badge tone="mist">Soon</Badge>
                          </CardBody>
                        </Card>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </section>
        )}

        {explore && <ExploreSections explore={explore} name={area.name} />}

        {areas.length === 0 && landmarks.length === 0 && listings.length === 0 && (
          <p className="text-muted">Nothing here yet. Local partners are still being added.</p>
        )}
      </div>
    </main>
  );
}
