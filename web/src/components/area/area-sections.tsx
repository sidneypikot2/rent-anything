import Link from "next/link";
import type { ReactNode } from "react";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { GlassPanel } from "@/components/ui/glass";
import { PillLink } from "@/components/ui/pill";
import { Section } from "@/components/ui/section";
import { ArrowGlyph, CategoryGlyph, ChevronGlyph } from "@/components/discovery/tag-glyphs";
import { countText, type Question, type SampleDay, type stayPlaces } from "./area-guide";

// The parts of an area page that get to know the place (RAA-252), each on the frame's glass and
// each left out when the place has nothing for it. What they say is worked out in area-guide.ts.

// The page's sections as a row of links under the banner, so a guest who came to get to know the
// place jumps to what they want to know; only the sections it has. Not sticky: What to book's
// own chips and rail stick under the header.
export function AreaTabs({ tabs }: { tabs: { id: string; label: string }[] }) {
  if (tabs.length < 3) return null;
  return (
    <nav aria-label="On this page" className="px-inset">
      <ul className="-my-1 flex gap-2 overflow-x-auto py-1 [scrollbar-width:none]">
        {tabs.map((tab) => (
          <li key={tab.id} className="shrink-0">
            <PillLink href={`#${tab.id}`} tone="glass">
              {tab.label}
            </PillLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function AreaAbout({
  name,
  description,
  bestTime,
}: {
  name: string;
  description: string | null;
  bestTime: string | null;
}) {
  if (!description && !bestTime) return null;
  return (
    <Section id="about" surface="glass" title={`What ${name} is like`}>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:gap-gutter">
        {description && <p className="max-w-prose text-lg leading-relaxed text-pretty whitespace-pre-line">{description}</p>}
        {bestTime && <Fact label="Best time to go" className="lg:w-72 lg:shrink-0">{bestTime}</Fact>}
      </div>
    </Section>
  );
}

export function AreaGettingHere({
  name,
  route,
  around,
}: {
  name: string;
  route: string | null;
  // The ways to get around it offered here, each linking to its group in What to book.
  around: { icon: string; label: string; detail: string; href: string }[];
}) {
  if (!route && around.length === 0) return null;
  return (
    <Section id="getting-here" testId="area-getting-here" surface="glass" title="Getting here and around">
      <div className="grid gap-gutter md:grid-cols-2">
        {route && (
          <Fact label={`Getting to ${name}`}>
            <span className="whitespace-pre-line">{route}</span>
          </Fact>
        )}
        {around.length > 0 && (
          <GlassPanel tone="card" className="flex flex-col gap-3 rounded-card p-card">
            <p className="text-sm font-semibold text-sky-pale">Getting around</p>
            <ul className="flex flex-col gap-2">
              {around.map((way) => (
                <li key={way.label}>
                  <Link
                    href={way.href}
                    className="group flex min-h-11 items-center gap-3 rounded-control transition-colors duration-300 ease-calm hover:bg-glass-hover"
                  >
                    <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-control bg-glass-fill">
                      <CategoryGlyph name={way.icon} className="size-5 text-sky-pale" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{way.label}</span>
                      <span className="block text-sm text-sky-mist">{way.detail}</span>
                    </span>
                    <ArrowGlyph className="size-4 shrink-0 text-sky-pale motion-safe:transition-transform motion-safe:duration-500 motion-safe:ease-calm motion-safe:group-hover:translate-x-0.5" />
                  </Link>
                </li>
              ))}
            </ul>
          </GlassPanel>
        )}
      </div>
    </Section>
  );
}

export function AreaStays({
  name,
  places,
  ownStays,
  datesQuery,
  ownHref,
}: {
  name: string;
  places: ReturnType<typeof stayPlaces>;
  ownStays: number;
  datesQuery: string;
  ownHref: string;
}) {
  if (places.length === 0 && ownStays === 0) return null;
  return (
    <Section id="stay" surface="glass" title={`Where to stay in ${name}`}>
      {places.length > 0 ? (
        <ul className="grid gap-gutter sm:grid-cols-2 lg:grid-cols-3">
          {places.map(({ place, near }) => (
            <li key={place.slug}>
              <Link href={`/${place.slug}${datesQuery}`} className="group block h-full">
                <GlassPanel tone="card" className="flex h-full flex-col gap-1 rounded-card p-card group-hover:bg-glass-hover">
                  <span className="text-lg font-semibold">{place.name}</span>
                  <span className="text-sm text-sky-mist">
                    {countText(place.stay_count, "stay")}
                    {near && ` · ${near.distance} from ${near.name}`}
                  </span>
                </GlassPanel>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-pretty">
          {countText(ownStays, "stay")} to book here.{" "}
          <Link href={ownHref} className="font-semibold text-link underline underline-offset-4">
            See the stays
          </Link>
        </p>
      )}
    </Section>
  );
}

export function AreaSampleDays({ days, planHref }: { days: SampleDay[]; planHref: string }) {
  if (days.length === 0) return null;
  return (
    <Section
      id="days"
      surface="glass"
      title={`A sample ${days.length === 1 ? "day" : `${days.length} days`}`}
      intro="Built from the places tours go to most. Start from it and change anything."
    >
      <ol className="flex flex-col gap-3">
        {days.map((day, index) => (
          <li key={day.title} className="flex gap-4">
            <span
              aria-hidden
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-action font-bold text-white"
            >
              {index + 1}
            </span>
            <div className="flex min-w-0 flex-col gap-0.5 pt-1.5">
              <span className="sr-only">Day {index + 1}: </span>
              <span className="text-lg font-semibold">{day.title}</span>
              <span className="text-pretty text-sky-mist">{day.plan}</span>
              {day.book.length > 0 && <span className="text-sm font-semibold text-sky-pale">{day.book.join(" · ")}</span>}
            </div>
          </li>
        ))}
      </ol>
      <div>
        <ButtonLink href={planHref} variant="paper" arrow data-testid="plan-from-days">
          Plan from these days
        </ButtonLink>
      </div>
    </Section>
  );
}

// The questions guests ask, folded, and as FAQPage data for search engines.
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
    <Section id="faq" surface="glass" title={`Questions about ${name}`}>
      <script
        type="application/ld+json"
        // Escaped so text from the API can't close the script element.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
      />
      <div className="flex flex-col divide-y divide-glass-edge">
        {questions.map(({ question, answer }) => (
          <details key={question} className="group py-1">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 font-semibold [&::-webkit-details-marker]:hidden">
              {question}
              <ChevronGlyph
                className="size-4 shrink-0 text-sky-pale motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-calm group-open:rotate-180"
              />
            </summary>
            <p className="max-w-prose pb-4 text-pretty text-sky-mist">{answer}</p>
          </details>
        ))}
      </div>
    </Section>
  );
}

function Fact({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <GlassPanel tone="card" className={cn("flex flex-col gap-1 rounded-card p-card", className)}>
      <span className="text-sm font-semibold text-sky-pale">{label}</span>
      <span className="text-pretty">{children}</span>
    </GlassPanel>
  );
}
