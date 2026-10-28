import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { CheckGlyph } from "@/components/discovery/tag-glyphs";
import { BOOKING_STATE, LAUNCH_AREA, START_TRIP, startTripHref } from "@/components/landing/launch-area";
import { PageBanner } from "@/components/landing/page-banner";
import { PageSheet } from "@/components/landing/page-sheet";
import { BAND_PHOTO } from "@/components/landing/sample-photos";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { glassClasses } from "@/components/ui/glass";
import { Section } from "@/components/ui/section";
import { DisplayTitle } from "@/components/ui/typography";
import { BRAND, TAGLINE } from "@/lib/brand";

export const metadata: Metadata = {
  title: "About us",
  description: `Why we built ${BRAND}: one cart for a whole trip, from local partners, starting on ${LAUNCH_AREA.name}.`,
};

// Who we are and why, in the product's voice (PRODUCT.md): plain, local, and only what is true
// today — no team names, founding dates or numbers we can't stand behind, and the booking copy
// from BOOKING_STATE. A static page: nothing here needs the API or the session.
const BANNER_PHOTO = { src: "/images/samples/wooden-boat.jpg", alt: "" };

const PARTNER_POINTS = [
  {
    title: "Local partners list here themselves",
    body: "Rental shops, boat and tour operators, van drivers and guesthouses put up what they offer and keep it current.",
  },
  {
    title: "Partners pass an ID check before listing",
    body: "A partner verifies their ID before adding something new for travellers to book.",
  },
  {
    title: "The partner answers your request",
    body: `You send requests from your trip, and ${BOOKING_STATE.answer}.`,
  },
  {
    title: "We earn a commission on each booking",
    body: "That is how we make money, so we only do well when your trip comes together.",
  },
];

// The founders, by first name, with square photos cropped around the face
// (public/images/team/<name>.jpg, 640px).
const FOUNDERS = [
  { name: "Paul", role: "Co-founder & CEO" },
  { name: "Christopher", role: "Co-founder & COO" },
  { name: "Sidney", role: "Co-founder & CTO" },
].map(({ name, role }) => ({
  name,
  role,
  photo: `/images/team/${name.toLowerCase()}.jpg`,
}));

export default function AboutPage() {
  return (
    <main className="flex flex-1 flex-col">
      <PageBanner
        photo={BANNER_PHOTO}
        search={false}
        eyebrow={`About ${BRAND}`}
        title={
          <>
            <DisplayTitle className="text-balance">{TAGLINE}.</DisplayTitle>
            <p className="max-w-lede text-pretty text-sky-mist sm:text-lg">
              The boat, the bike and the bed for one trip, from the people who run them, planned in one place.
            </p>
          </>
        }
      />

      <PageSheet tone="clear">
        <div className="page-sections mx-auto flex w-full max-w-page flex-col gap-section py-page-pad">
          <Section surface="glass" title="Why we started">
            <div className="flex max-w-prose flex-col gap-4 text-pretty text-sky-mist">
              <p>
                A few days on {LAUNCH_AREA.name} can mean messaging a van operator for the trip from Cebu, a shop for
                a scooter, a boatman for island hopping and a guesthouse for the nights, one by one, and hoping the
                dates line up.
              </p>
              <p>
                {BRAND} puts all of it in one place, organised around where you&apos;re going. Pick a place, add what
                you need there, and it lands in one cart, grouped into trips. A trip keeps its dates and guests, and
                it can span more than one island or city.
              </p>
            </div>
          </Section>

          <Section surface="photo" title="How we work with local partners">
            <ul className={cn(glassClasses("dark"), "grid gap-5 rounded-card p-5 sm:grid-cols-2 sm:gap-gutter sm:p-card")}>
              {PARTNER_POINTS.map((point) => (
                <li key={point.title} className="flex gap-3">
                  <CheckGlyph className="mt-1 size-5 shrink-0 text-mint" />
                  <span className="flex flex-col gap-1">
                    <span className="text-title-sm font-extrabold tracking-tight text-white">{point.title}</span>
                    <span className="text-sm leading-relaxed text-pretty text-sky-mist">{point.body}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Section>

          <Section surface="glass" title={`Starting on ${LAUNCH_AREA.name}`}>
            <div className="flex max-w-prose flex-col gap-4 text-pretty text-sky-mist">
              <p>
                We&apos;re starting with one island, {LAUNCH_AREA.name} in northern {LAUNCH_AREA.region}, and doing it
                properly: enough partners and listings that a whole trip can come together here.
              </p>
              <p>
                The islands, mountains and cities of the Philippines come next. Other destinations appear as partners
                there list with us. Run something travellers book?{" "}
                <Link href="/partner/register" className="font-semibold text-white underline">
                  List with us
                </Link>
                .
              </p>
            </div>
          </Section>

          <Section surface="photo" align="center" title="The founders">
            <ul className="cascade mx-auto grid w-full max-w-3xl grid-cols-3 gap-gutter">
              {FOUNDERS.map((founder) => (
                <li key={founder.name} className="flex flex-col items-center gap-3 text-center">
                  <Image
                    src={founder.photo}
                    alt={`${founder.name}, ${founder.role} of ${BRAND}`}
                    width={176}
                    height={176}
                    sizes="(min-width: 640px) 11rem, 6rem"
                    className="card-edge aspect-square size-24 rounded-full object-cover shadow-float sm:size-44"
                  />
                  <span className="flex flex-col">
                    <span className="text-title-sm font-extrabold tracking-tight text-white sm:text-lg">{founder.name}</span>
                    <span className="text-sm text-sky-mist">{founder.role}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Section>

          {/* The closing band, as the home page's (PlanCta) but static: one way in, a trip on the launch area. */}
          <section className="band reveal card-edge relative isolate flex flex-col items-start gap-5 overflow-hidden rounded-frame px-inset py-7 text-white sm:flex-row sm:items-center sm:justify-between sm:gap-8 sm:py-10">
            <Image src={BAND_PHOTO} alt="" fill sizes="(min-width: 72rem) 72rem, 100vw" className="-z-20 object-cover" />
            <div aria-hidden className="absolute inset-0 -z-10 band-fill" />
            <div>
              <h2 className="font-display text-band leading-[1.1] font-extrabold tracking-tight text-balance">
                Start with {LAUNCH_AREA.name}
              </h2>
              <p className="mt-2 max-w-lede text-pretty text-sky-mist">{START_TRIP.note}</p>
            </div>
            <ButtonLink href={startTripHref(LAUNCH_AREA.slug)} variant="paper" arrow className="shrink-0 sm:whitespace-nowrap">
              {START_TRIP.action}
            </ButtonLink>
          </section>
        </div>
      </PageSheet>
    </main>
  );
}
