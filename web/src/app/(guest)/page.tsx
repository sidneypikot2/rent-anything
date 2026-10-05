import { getActivities, getDestinations } from "@/api/discovery";
import { ActivityCard, DestinationCard } from "@/components/discovery/cards";
import { tagIcon } from "@/components/discovery/icons";
import { SearchBox } from "@/components/discovery/search-box";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { PillLink } from "@/components/ui/pill";
import { DisplayTitle, Eyebrow, SectionTitle } from "@/components/ui/typography";

const FEATURES = [
  { icon: "🧺", title: "One cart per trip", body: "Tours, rides, gear and a room for the same place, paid in one checkout." },
  { icon: "🤝", title: "Local, verified partners", body: "ID-checked shops, guides and guesthouses who know the island." },
  { icon: "📱", title: "Pay with GCash or card", body: "Pay in the app; partners are paid after your trip goes well." },
  { icon: "🧭", title: "Plan by what you love", body: "Search an activity or a landmark and we show where to go." },
];

// The guest home: search first, then destinations and activities to browse. A guest who
// hasn't chosen where to go starts here; picking a destination leads to its area page.
export default async function Home() {
  const [destinations, activities] = await Promise.all([getDestinations(), getActivities()]);

  const stats = [
    { value: destinations.length, label: "Destinations" },
    { value: destinations.reduce((sum, area) => sum + area.landmark_count, 0), label: "Places to see" },
    { value: destinations.reduce((sum, area) => sum + area.listing_count, 0), label: "Things to book" },
    { value: activities.length, label: "Activities" },
  ];

  return (
    <main className="flex flex-1 flex-col">
      <section className="border-b border-line bg-linear-to-br from-mist via-surface to-sage px-4 pb-16 pt-14 text-center sm:pt-20">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-5">
          <span className="rounded-full border-[1.5px] border-line bg-surface px-4 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
            ✦ Islands and cities of Cebu
          </span>
          <DisplayTitle size="hero">
            Find your next <span className="not-italic text-primary">island escape</span>
          </DisplayTitle>
          <p className="max-w-md text-lg text-muted">
            Search a place, a landmark or something you love doing. We&apos;ll show you where to go and what to
            book there.
          </p>
          <SearchBox />
          {activities.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2">
              {activities.slice(0, 6).map((activity) => (
                <PillLink key={activity.slug} href={`/search?q=${encodeURIComponent(activity.name)}`}>
                  {tagIcon(activity.slug)} {activity.name}
                </PillLink>
              ))}
            </div>
          )}
        </div>
      </section>

      <div className="mx-auto flex w-full max-w-5xl flex-col gap-14 px-4 py-12">
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="flex flex-col rounded-2xl border-[1.5px] border-line bg-surface-2 p-4 text-center">
              <dt className="order-2 text-xs font-semibold uppercase tracking-wider text-muted">{stat.label}</dt>
              <dd className="font-display text-4xl font-bold text-primary">{stat.value}</dd>
            </div>
          ))}
        </dl>

        <section id="activities" className="flex scroll-mt-6 flex-col gap-4">
          <div>
            <Eyebrow>What do you want to do?</Eyebrow>
            <SectionTitle>Browse by activity</SectionTitle>
          </div>
          {activities.length === 0 ? (
            <p className="text-muted">Activities appear here once destinations have things to book.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {activities.map((activity) => (
                <ActivityCard key={activity.slug} activity={activity} />
              ))}
            </div>
          )}
        </section>

        <section id="destinations" className="flex scroll-mt-6 flex-col gap-4">
          <div>
            <Eyebrow>Top picks this season</Eyebrow>
            <SectionTitle>Destinations</SectionTitle>
          </div>
          {destinations.length === 0 ? (
            <p className="text-muted">No destinations yet.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {destinations.map((area) => (
                <DestinationCard key={area.slug} area={area} />
              ))}
            </div>
          )}
        </section>

        <section className="flex flex-col gap-4">
          <SectionTitle>Why Rent-Anything</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((feature) => (
              <Card key={feature.title}>
                <CardBody pad="lg" className="flex flex-col gap-2">
                  <span aria-hidden className="flex size-11 items-center justify-center rounded-xl bg-sage text-2xl">
                    {feature.icon}
                  </span>
                  <h3 className="font-semibold">{feature.title}</h3>
                  <p className="text-sm text-muted">{feature.body}</p>
                </CardBody>
              </Card>
            ))}
          </div>
        </section>

        <section className="flex flex-col items-start gap-4 rounded-3xl bg-navy p-8 text-white sm:flex-row sm:items-center sm:justify-between">
          <div>
            <SectionTitle>Your next island trip starts here.</SectionTitle>
            <p className="mt-1 text-on-dark">Create a free account to keep one cart per destination.</p>
          </div>
          <ButtonLink href="/register" variant="accent">
            Create an account
          </ButtonLink>
        </section>
      </div>
    </main>
  );
}
