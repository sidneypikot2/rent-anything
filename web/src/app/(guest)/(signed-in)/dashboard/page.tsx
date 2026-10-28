"use client";

import { tripHref } from "@/components/landing/launch-area";
import { PageSheet } from "@/components/landing/page-sheet";
import { ArrowGlyph } from "@/components/discovery/tag-glyphs";
import { tripDetails } from "@/components/trips/format";
import { currentTrips, useTrips } from "@/components/trips/use-trips";
import { ButtonLink } from "@/components/ui/button";
import { CardLink } from "@/components/ui/card";
import { DisplayTitle, SectionTitle } from "@/components/ui/typography";
import { useSession } from "@/lib/auth/session";

// The rest of the account, one tap each: booked trips (RAA-140), then the guest's details.
const LINKS = [
  { href: "/trips", title: "Booked trips", note: "Trips with a request or booking, and past ones" },
  { href: "/profile", title: "Profile", note: "Your name, phone and address" },
];

// Where a guest lands after signing in: the trips they are planning, each opening in the cart,
// then the rest of their account. Only what exists today: no stand-ins for what isn't built.
export default function GuestDashboard() {
  const session = useSession();
  const trips = useTrips(true);
  const planning = currentTrips(trips.data);

  return (
    <main data-testid="guest-dashboard" className="flex flex-1 flex-col pt-3 sm:pt-6">
      <PageSheet>
        <div className="mx-auto flex w-full max-w-narrow flex-1 flex-col gap-section px-gutter py-page-pad">
          <DisplayTitle>Hi, {session?.user.name ?? session?.user.email}</DisplayTitle>

          <section className="flex flex-col gap-block" aria-busy={trips.isPending}>
            <SectionTitle>Trips you&apos;re planning</SectionTitle>
            {trips.isPending ? (
              <div className="h-20 animate-pulse rounded-card bg-glass-fill" />
            ) : trips.isError ? (
              <p className="text-sm text-sky-mist">Couldn&apos;t load your trips. Refresh the page to try again.</p>
            ) : planning.length === 0 ? (
              <div className="flex flex-col items-start gap-3">
                <p className="text-pretty text-sky-mist">
                  No trips yet. Pick a place and add the first thing you need: a trip starts with it.
                </p>
                <ButtonLink href="/" variant="paper" arrow>
                  Find a destination
                </ButtonLink>
              </div>
            ) : (
              <ul className="flex flex-col gap-3" data-testid="dashboard-trips">
                {planning.map((trip) => (
                  <li key={trip.id}>
                    <DashboardLink href={tripHref(trip.id)} title={trip.name} note={tripDetails(trip)} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="flex flex-col gap-block">
            <SectionTitle>Your account</SectionTitle>
            <ul className="grid gap-3 sm:grid-cols-2">
              {LINKS.map((link) => (
                <li key={link.href}>
                  <DashboardLink {...link} />
                </li>
              ))}
            </ul>
          </section>
        </div>
      </PageSheet>
    </main>
  );
}

function DashboardLink({ href, title, note }: { href: string; title: string; note: string }) {
  return (
    <CardLink href={href} className="flex h-full items-center gap-3 p-4">
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-semibold text-pretty">{title}</span>
        <span className="text-sm text-pretty text-muted">{note}</span>
      </span>
      <ArrowGlyph className="size-4 shrink-0 text-primary" />
    </CardLink>
  );
}
