import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { isApiPhoto } from "@/components/landing/sample-photos";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { SectionTitle } from "@/components/ui/typography";
import {
  AlertGlyph,
  CategoryGlyph,
  FeatureGlyph,
  InfoGlyph,
  TagGlyph,
  WalletGlyph,
} from "@/components/discovery/tag-glyphs";
import type { Question, SampleDay, stayPlaces } from "./area-guide";
import { SEASON_LABEL, type AreaNotes, type KnowTopic, type Season } from "./area-notes";

// The parts of an area page that get to know the place (RAA-252, the area page revamp's
// mockup): the banner's quick facts, What it's like, and one white sheet of When to go, Getting
// here and around, Where to stay, Good to know, a sample few days and the questions guests ask.
// Each part is left out when the place has nothing for it. What they say is worked out in
// area-guide.ts and, for what no data holds yet, written in area-notes.ts.

// Under the banner's title: the tagline, what the place is for (its places' tags) and the quick facts.
export function AreaBannerIntro({
  tagline,
  vibes,
  facts,
}: {
  tagline: string | null;
  vibes: string[];
  facts: { label: string; value: string }[];
}) {
  if (!tagline && vibes.length === 0 && facts.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      {tagline && (
        <p data-testid="area-tagline" className="max-w-lede text-lg text-pretty text-white/90 max-sm:text-base">
          {tagline}
        </p>
      )}
      {vibes.length > 0 && (
        <ul aria-label="Known for" className="flex flex-wrap gap-2 max-sm:hidden">
          {vibes.map((vibe) => (
            <li key={vibe}>
              <Badge tone="glass">{vibe}</Badge>
            </li>
          ))}
        </ul>
      )}
      {facts.length > 0 && (
        <dl data-testid="area-facts" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {facts.map((fact) => (
            <div key={fact.label} className="flex flex-col gap-0.5 rounded-control border border-glass-edge bg-glass-fill px-3 py-2">
              <dt className="text-small text-sky-pale">{fact.label}</dt>
              <dd className="text-sm font-semibold">{fact.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

// What it's like, on its own white sheet before the places to see: the team's description, who
// it suits, and the three places tours go to most, linked to their cards.
export function AreaAbout({
  name,
  description,
  goodFor,
  highlights,
}: {
  name: string;
  description: string | null;
  goodFor?: string;
  highlights: { slug: string; name: string; line: string; photo: { src: string; alt: string } | null }[];
}) {
  if (!description && highlights.length === 0) return null;
  return (
    <section id="about" data-surface="paper" className="grid gap-block lg:grid-cols-[5fr_7fr] lg:items-start lg:gap-gutter">
      <div className="flex flex-col gap-3">
        <SectionTitle>What {name} is like</SectionTitle>
        {description && <p className="text-lg leading-relaxed text-pretty whitespace-pre-line">{description}</p>}
        {goodFor && <p className="text-sm text-pretty text-muted">{goodFor}</p>}
      </div>
      {highlights.length > 0 && (
        <ul className="grid grid-cols-3 gap-3 max-sm:-mx-1 max-sm:overflow-x-auto max-sm:grid-cols-[repeat(3,minmax(10rem,1fr))]">
          {highlights.map((place) => (
            <li key={place.slug}>
              <a
                href={`#${place.slug}`}
                className="group relative isolate flex h-52 items-end overflow-hidden rounded-card bg-navy p-2.5 shadow-soft"
              >
                {place.photo && (
                  <Image
                    src={place.photo.src}
                    alt={place.photo.alt}
                    fill
                    sizes="(min-width: 64rem) 20vw, 40vw"
                    unoptimized={isApiPhoto(place.photo.src)}
                    className="-z-10 object-cover transition-transform duration-700 ease-calm motion-safe:group-hover:scale-105"
                  />
                )}
                <span className="w-full rounded-control bg-surface px-3 py-2 text-navy">
                  <span className="block font-semibold">{place.name}</span>
                  {place.line && <span className="block truncate text-small text-muted">{place.line}</span>}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// The white sheet holding the rest of the guide, its parts one section step apart.
export function AreaGuideSheet({ children }: { children: ReactNode }) {
  return (
    <section aria-label="Getting to know the place" data-surface="paper" className="flex flex-col gap-section">
      {children}
    </section>
  );
}

function Part({ id, testId, title, intro, children }: { id: string; testId?: string; title: string; intro?: string; children: ReactNode }) {
  return (
    <section id={id} data-testid={testId} className="flex flex-col gap-block">
      <header className="flex max-w-prose flex-col gap-2">
        <SectionTitle>{title}</SectionTitle>
        {intro && <p className="text-pretty text-muted">{intro}</p>}
      </header>
      {children}
    </section>
  );
}

const SEASON_TILE: Record<Season, string> = {
  dry: "bg-sky-deep text-white",
  drying: "bg-sky-pale text-navy",
  wet: "bg-tag text-muted",
};
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function AreaWhenToGo({
  seasons,
  busy,
  timing,
  bestTime,
  yourDates,
}: {
  seasons: AreaNotes["seasons"] | null;
  busy: Set<number>;
  timing: AreaNotes["timing"];
  bestTime: string | null;
  // The page's dates and their season, when it has dates.
  yourDates: string | null;
}) {
  if (!seasons && !bestTime) return null;
  return (
    <Part id="when" title="When to go" intro={bestTime ?? undefined}>
      {seasons && (
        <>
          <ol className="grid grid-cols-6 gap-1.5 sm:grid-cols-12">
            {seasons.map((season, month) => (
              <li
                key={MONTHS[month]}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-control px-1 py-2.5 text-center",
                  SEASON_TILE[season],
                  busy.has(month) && "ring-2 ring-warning ring-offset-2 ring-offset-surface-2",
                )}
              >
                <span className="text-sm font-bold">{MONTHS[month]}</span>
                <span className="text-small font-semibold max-sm:sr-only">
                  {SEASON_LABEL[season]}
                  {busy.has(month) && <span className="sr-only">, busy</span>}
                </span>
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted">
            <Key className={SEASON_TILE.dry}>Dry, sunny</Key>
            <Key className={SEASON_TILE.drying}>Drying out</Key>
            <Key className={SEASON_TILE.wet}>Wet, typhoon risk</Key>
            <Key className="ring-2 ring-warning">Busy: Holy Week, Christmas</Key>
            {yourDates && <span className="font-semibold text-navy sm:ml-auto">{yourDates}</span>}
          </div>
        </>
      )}
      {timing.length > 0 && (
        <ul className="grid gap-3 md:grid-cols-3">
          {timing.map((tip) => (
            <li key={tip.title} className="rounded-card bg-tag px-4 py-3.5 text-sm leading-relaxed text-pretty">
              <b>{tip.title}.</b> {tip.text}
            </li>
          ))}
        </ul>
      )}
    </Part>
  );
}

function Key({ className, children }: { className: string; children: ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <span aria-hidden className={cn("size-3 rounded-sm", className)} />
      {children}
    </span>
  );
}

export function AreaGettingHere({
  name,
  route,
  routeText,
  routeSummary,
  transferHref,
  around,
}: {
  name: string;
  route: AreaNotes["route"];
  // With no steps written, the one line of how to get there.
  routeText: string | null;
  routeSummary: string | null;
  transferHref: string | null;
  around: { icon: string; label: string; note: string; link: string; href: string }[];
}) {
  const here = route.length > 0 || routeText;
  if (!here && around.length === 0) return null;
  return (
    <section id="getting-here" data-testid="area-getting-here" className="grid gap-section lg:grid-cols-[7fr_5fr] lg:gap-gutter">
      {here && (
        <div className="flex flex-col gap-block">
          <SectionTitle>Getting to {name}</SectionTitle>
          <Card edge="line" className="px-4 py-2 sm:px-5">
            {route.length > 0 ? (
              <ol className="divide-y divide-line">
                {route.map((step, index) => (
                  <li key={step.what} className="flex items-center gap-3.5 py-3">
                    <span
                      aria-hidden
                      className="flex size-10 shrink-0 items-center justify-center rounded-control bg-tag text-sm font-extrabold text-primary"
                    >
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{step.what}</span>
                      <span className="block text-sm text-muted">{step.note}</span>
                    </span>
                    <span className="shrink-0 text-sm font-bold">{step.time}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="py-3 text-pretty whitespace-pre-line">{routeText}</p>
            )}
            {(routeSummary || transferHref) && (
              <div className="flex flex-wrap items-center gap-3 border-t border-line pt-3.5 pb-2">
                {routeSummary && <span className="text-sm text-muted">{routeSummary}</span>}
                {transferHref && (
                  <ButtonLink href={transferHref} variant="soft" size="touch" className="ml-auto">
                    Find a transfer
                  </ButtonLink>
                )}
              </div>
            )}
          </Card>
        </div>
      )}
      {around.length > 0 && (
        <div className="flex flex-col gap-block">
          <SectionTitle>Getting around</SectionTitle>
          <ul className="flex flex-col gap-3">
            {around.map((way) => (
              <li key={way.label}>
                <Card edge="line" className="flex items-center gap-3 p-4">
                  <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-mist text-primary">
                    <CategoryGlyph name={way.icon} className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{way.label}</span>
                    <span className="block text-sm text-pretty text-muted">{way.note}</span>
                  </span>
                  <Link href={way.href} className="shrink-0 text-sm font-bold text-link underline underline-offset-4">
                    {way.link}
                  </Link>
                </Card>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export function AreaStays({
  name,
  places,
  towns,
  ownStays,
  ownHref,
  hrefFor,
}: {
  name: string;
  places: ReturnType<typeof stayPlaces>;
  towns: AreaNotes["towns"];
  ownStays: number;
  ownHref: string;
  hrefFor: (slug: string) => string;
}) {
  if (places.length === 0 && ownStays === 0) return null;
  return (
    <Part id="stay" title={`Where to stay in ${name}`}>
      {places.length > 0 ? (
        <ul className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {places.map(({ place, near }) => {
            const town = towns?.[place.slug];
            return (
              <li key={place.slug}>
                <Card edge="line" className="flex h-full flex-col gap-2 p-card">
                  <span className="flex items-center gap-2">
                    <span className="flex-1 text-lg font-semibold">{place.name}</span>
                    {town && <Badge tone="mist">{town.tag}</Badge>}
                  </span>
                  {town && <span className="text-sm leading-relaxed text-pretty">{town.line}</span>}
                  <span className="text-sm text-muted">
                    {place.stay_count === 1 ? "1 stay" : `${place.stay_count} stays`}
                    {near && ` · ${near.distance} from ${near.name}`}
                  </span>
                  <Link href={hrefFor(place.slug)} className="mt-auto text-sm font-bold text-link underline underline-offset-4">
                    Stays in {place.name}
                  </Link>
                </Card>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-pretty">
          {ownStays === 1 ? "1 stay" : `${ownStays} stays`} to book here.{" "}
          <Link href={ownHref} className="font-semibold text-link underline underline-offset-4">
            See the stays
          </Link>
        </p>
      )}
    </Part>
  );
}

const KNOW_ICON: Record<KnowTopic, ReactNode> = {
  cash: <WalletGlyph className="size-5" />,
  signal: <FeatureGlyph name="wifi" className="size-5" />,
  weather: <AlertGlyph className="size-5" />,
  respect: <TagGlyph slug="religious" className="size-5" />,
  food: <FeatureGlyph name="breakfast" className="size-5" />,
  health: <InfoGlyph className="size-5" />,
};

export function AreaGoodToKnow({ notes }: { notes: AreaNotes["know"] }) {
  if (notes.length === 0) return null;
  return (
    <Part id="know" title="Good to know">
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {notes.map((note) => (
          <li key={note.title}>
            <Card edge="line" className="flex h-full gap-3 p-4">
              <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-mist text-primary">
                {KNOW_ICON[note.topic]}
              </span>
              <span className="flex flex-col gap-1">
                <span className="font-semibold">{note.title}</span>
                <span className="text-sm leading-relaxed text-pretty text-muted">{note.text}</span>
              </span>
            </Card>
          </li>
        ))}
      </ul>
    </Part>
  );
}

export function AreaSampleDays({ days, planHref, planLabel }: { days: SampleDay[]; planHref: string; planLabel: string }) {
  if (days.length === 0) return null;
  return (
    <Part
      id="days"
      title={`A sample ${days.length === 1 ? "day" : `${days.length} days`}`}
      intro="Built from the places to see and the tours that go there."
    >
      <ol className="grid gap-3.5 md:grid-cols-3">
        {days.map((day, index) => (
          <li key={day.title}>
            <Card edge="line" className="flex h-full flex-col gap-2 p-card">
              <span className="text-small font-extrabold text-primary">Day {index + 1}</span>
              <span className="text-title-sm font-semibold">{day.title}</span>
              <span className="text-sm leading-relaxed text-pretty">{day.plan}</span>
              {day.book.length > 0 && <span className="mt-auto text-sm font-semibold text-muted">{day.book.join(" · ")}</span>}
            </Card>
          </li>
        ))}
      </ol>
      <div className="flex flex-col items-start gap-4 rounded-card bg-aqua px-5 py-4 sm:flex-row sm:items-center sm:px-6">
        <div className="flex flex-col gap-0.5">
          <span className="text-title-sm font-bold">Make it your trip</span>
          <span className="text-sm text-pretty text-navy/80">
            Start from these days: we&apos;ll line up the transfer, a stay and the tours, and you change anything.
          </span>
        </div>
        <ButtonLink href={planHref} arrow data-testid="plan-from-days" className="shrink-0 sm:ml-auto sm:whitespace-nowrap">
          {planLabel}
        </ButtonLink>
      </div>
    </Part>
  );
}

// The questions guests ask, open on a grid, and as FAQPage data for search engines.
export function AreaQuestions({ name, questions }: { name: string; questions: Question[] }) {
  if (questions.length === 0) return null;
  const data = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: questions.map(({ question, answer }) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: { "@type": "Answer", text: answer },
    })),
  };
  return (
    <Part id="faq" title={`Questions about ${name}`}>
      <script
        type="application/ld+json"
        // Escaped so text from the API can't close the script element.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
      />
      <dl className="grid gap-2.5 md:grid-cols-2">
        {questions.map(({ question, answer }) => (
          <Card key={question} edge="line" className="flex flex-col gap-1 px-4 py-3.5">
            <dt className="font-semibold">{question}</dt>
            <dd className="text-sm leading-relaxed text-pretty text-muted">{answer}</dd>
          </Card>
        ))}
      </dl>
    </Part>
  );
}
