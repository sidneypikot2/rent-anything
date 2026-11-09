import Link from "next/link";
import type { ReactNode } from "react";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { glassClasses } from "@/components/ui/glass";
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
import { ListingRow, type RowCard } from "./listing-row";
import { SEASON_LABEL, type AreaNotes, type KnowTopic, type Season } from "./area-notes";

// The parts of an area page that get to know the place (RAA-252, the area page revamp's
// mockup): the banner's intro and quick facts, and one white sheet of When to go, Getting
// here and around, Where to stay, Things to do, Good to know, a sample few days and the questions guests ask.
// Each part is left out when the place has nothing for it. What they say is worked out in
// area-guide.ts and, for what no data holds yet, written in area-notes.ts.

// Under the banner's title: the tagline, the team's description (two lines at most, so the
// banner still fits the first screen), who the place suits, what it is for (its places' tags) and
// the quick facts.
export function AreaBannerIntro({
  tagline,
  description,
  goodFor,
  vibes,
  facts,
}: {
  tagline: string | null;
  description?: string | null;
  goodFor?: AreaNotes["goodFor"];
  vibes: string[];
  facts: { label: string; value: string }[];
}) {
  if (!tagline && !description && !goodFor && vibes.length === 0 && facts.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      {tagline && (
        <p data-testid="area-tagline" className="max-w-lede text-lg text-pretty text-white/90 max-sm:text-base">
          {tagline}
        </p>
      )}
      {description && (
        <p className={cn("line-clamp-2 max-w-lede text-base text-pretty text-white/90", tagline && "max-sm:line-clamp-1")}>{description}</p>
      )}
      {goodFor && (
        // Two labelled lines in white at body size: the small pale line read poorly over a bright photo.
        <dl data-testid="area-good-for" className="flex max-w-lede flex-col gap-1 text-base text-pretty max-sm:text-sm">
          <div>
            <dt className="inline font-semibold text-white">Good for </dt>
            <dd className="inline text-white/90">{goodFor.yes}</dd>
          </div>
          {goodFor.no && (
            <div>
              <dt className="inline font-semibold text-white">Not for </dt>
              <dd className="inline text-white/90">{goodFor.no}</dd>
            </div>
          )}
        </dl>
      )}
      {vibes.length > 0 && (
        // Named, and on the fact tiles' card glass, so the chips read over any photo.
        <div className="flex flex-wrap items-center gap-2 max-sm:hidden">
          <span id="area-known-for" className="text-small font-semibold text-white/90">
            Known for
          </span>
          <ul aria-labelledby="area-known-for" className="flex flex-wrap gap-2">
            {vibes.map((vibe) => (
              <li key={vibe} className={cn("rounded-chip px-3 py-1 text-small font-semibold", glassClasses("card"))}>
                {vibe}
              </li>
            ))}
          </ul>
        </div>
      )}
      {facts.length > 0 && (
        // From sm each tile as wide as its words, wrapping as a row of chips, so six fit where four did.
        <dl data-testid="area-facts" className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          {facts.map((fact, index) => (
            // The card glass, as a photo card's text panel: any banner photo, however bright, keeps
            // its label at 5:1 (the faint glass fill fell near 2:1 over a pale one). A phone keeps
            // the first four, so the banner still fits its first screen.
            <div
              key={fact.label}
              className={cn(
                "flex flex-col gap-0.5 rounded-control px-3 py-2 sm:whitespace-nowrap",
                glassClasses("card"),
                index >= 4 && "max-sm:hidden",
              )}
            >
              <dt className="text-small text-sky-mist">{fact.label}</dt>
              <dd className="text-sm font-semibold">{fact.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
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
  // An edge, as its tint is close to the sheet's and the key's swatch would vanish without one.
  wet: "bg-tag text-muted inset-ring-1 inset-ring-line-strong",
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
                {/* Said on a phone too, so a month's season never rests on its colour alone. */}
                <span className="text-small font-semibold">
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
  // Side by side only when both columns have something to hold: one way around beside the route
  // left most of its column empty, so it then goes under the route instead.
  const beside = here && around.length > 1;
  return (
    <section
      id="getting-here"
      data-testid="area-getting-here"
      className={cn("grid grid-cols-1 gap-section", beside ? "lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-gutter" : "max-w-narrow")}
    >
      {here && (
        <div className="flex flex-col gap-block">
          <SectionTitle>Getting to {name}</SectionTitle>
          <Card edge="line" className="px-4 py-2 sm:px-5">
            {route.length > 0 ? (
              <ol className="divide-y divide-line">
                {route.map((step, index) => (
                  // At a large text size the time wraps under the step rather than squeezing it.
                  <li key={step.what} className="flex flex-wrap items-center gap-x-3.5 gap-y-1 py-3">
                    <span
                      aria-hidden
                      className="flex size-10 shrink-0 items-center justify-center rounded-control bg-tag text-sm font-extrabold text-primary"
                    >
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1 basis-32">
                      <span className="block font-semibold">{step.what}</span>
                      <span className="block text-sm text-muted">{step.note}</span>
                    </span>
                    <span className="ml-auto shrink-0 text-sm font-bold">{step.time}</span>
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
          {/* Rows in one card, as the route beside it. */}
          <Card edge="line" className="px-4 py-1 sm:px-5">
            <ul className="divide-y divide-line">
              {around.map((way) => (
                <li key={way.label} className="flex items-center gap-3 py-3">
                  <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-mist text-primary">
                    <CategoryGlyph name={way.icon} className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{way.label}</span>
                    <span className="block text-sm text-pretty text-muted">{way.note}</span>
                  </span>
                  <Link href={way.href} className="tap-target shrink-0 text-sm font-bold text-link underline underline-offset-4">
                    {way.link}
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}
    </section>
  );
}

export function AreaStays({
  name,
  places,
  towns,
  stays,
  ownHref,
}: {
  name: string;
  places: ReturnType<typeof stayPlaces>;
  towns: AreaNotes["towns"];
  stays: RowCard[];
  ownHref: string;
}) {
  if (stays.length === 0) return null;
  // Where many stays are, in a line under the title: the town with the most, and its note.
  const top = places[0];
  const town = top ? towns?.[top.place.slug] : undefined;
  const intro = top && (town || places.length > 1) ? `Many stays are in ${top.place.name}${town ? `: ${lowerFirst(town.line)}` : "."}` : undefined;
  return (
    <section id="stay" className="flex flex-col gap-block">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div className="flex max-w-prose flex-col gap-2">
          <SectionTitle>{`Where to stay in ${name}`}</SectionTitle>
          {intro && <p className="text-pretty text-muted">{intro}</p>}
        </div>
        <Link
          href={ownHref}
          data-testid="area-stays-all"
          className="tap-target text-sm font-bold text-link underline underline-offset-4"
        >
          See all stays in {name}
        </Link>
      </header>
      <ListingRow cards={stays.slice(0, ROW_CARDS)} kind="stay" noun="stays" testId="area-stays" />
    </section>
  );
}

// Things to do: the tours and activities here, as a row of cards like Where to stay's.
export function AreaThingsToDo({
  name,
  partners,
  activities,
  ownHref,
  gear = 0,
  gearHref,
}: {
  name: string;
  partners: number;
  activities: RowCard[];
  ownHref: string;
  gear?: number;
  gearHref?: string;
}) {
  if (activities.length === 0) return null;
  const intro = `Tours and activities from ${partners === 1 ? "1 local partner" : `${partners} local partners`}.`;
  return (
    <section id="do" className="flex flex-col gap-block">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div className="flex max-w-prose flex-col gap-2">
          <SectionTitle>{`Things to do in ${name}`}</SectionTitle>
          <p className="text-pretty text-muted">{intro}</p>
        </div>
        <div className="flex flex-wrap gap-x-5">
          <Link
            href={ownHref}
            data-testid="area-activities-all"
            className="tap-target text-sm font-bold text-link underline underline-offset-4"
          >
            See all things to do in {name}
          </Link>
          {gear > 0 && gearHref && (
            <Link
              href={gearHref}
              data-testid="area-activities-gear"
              className="tap-target text-sm font-bold text-link underline underline-offset-4"
            >
              Rent gear ({gear})
            </Link>
          )}
        </div>
      </header>
      <ListingRow cards={activities.slice(0, ROW_CARDS)} kind="activity" noun="things to do" testId="area-activities" />
    </section>
  );
}

// Getting around: the vehicles to rent here and the transfers that run on the island, as a row of
// cards (Klook's Transport row). It takes the place of Getting here's list of ways around, whose
// notes become its intro.
export function AreaGettingAround({
  name,
  cards,
  intro,
  links,
}: {
  name: string;
  cards: RowCard[];
  intro: string | null;
  links: { label: string; href: string; testId: string }[];
}) {
  if (cards.length === 0) return null;
  return (
    <section id="around" data-testid="area-around" className="flex flex-col gap-block">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div className="flex max-w-prose flex-col gap-2">
          <SectionTitle>{`Getting around ${name}`}</SectionTitle>
          {intro && <p className="text-pretty text-muted">{intro}</p>}
        </div>
        <div className="flex flex-wrap gap-x-5">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              data-testid={link.testId}
              className="tap-target text-sm font-bold text-link underline underline-offset-4"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </header>
      <ListingRow cards={cards.slice(0, ROW_CARDS)} kind="rental" noun="ways around" testId="area-around-row" />
    </section>
  );
}

// A row shows the first few; See N opens What to book on that group for the rest.
const ROW_CARDS = 10;

function lowerFirst(text: string) {
  return text.charAt(0).toLowerCase() + text.slice(1);
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
      {/* One card of divided notes, not a card each: the card clips each top row's rule. */}
      <Card edge="line" className="px-4 sm:px-5">
        <ul className="-my-px grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
          {notes.map((note) => (
            <li key={note.title} className="flex gap-3 border-t border-line py-4">
              <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-mist text-primary">
                {KNOW_ICON[note.topic]}
              </span>
              <span className="flex min-w-0 flex-col gap-1">
                <span className="font-semibold">{note.title}</span>
                <span className="text-sm leading-relaxed text-pretty text-muted">{note.text}</span>
              </span>
            </li>
          ))}
        </ul>
      </Card>
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
