"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { ActionBar } from "@/components/ui/action-bar";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { ArrowGlyph, TickGlyph } from "@/components/discovery/tag-glyphs";

type Step = { key: string; label: string };

// Adding a listing, laid out as a sidebar of its sections beside the current one (RAA-83).
// On a phone the sections are a row above it that scrolls sideways. Any section up to the
// furthest one reached can be opened again (RAA-93), so going back loses nothing; the
// wizard checks the current section before moving forward. Once the listing is saved and
// only its photos are left (RAA-109), `locked` closes the sections before. The sections sit on
// the page's white sheet; the current one is a card that rises in as it opens (RAA-111). The
// card's header shows how far along the partner is, as a count and a bar of one segment per
// section, with `cancel` (the way out, absent once the listing is saved) at its end.
// Moving to another section takes keyboard focus to it, so a screen reader reads where it
// landed, and on a phone scrolls the row of sections to show the current one.
export function WizardLayout({
  steps,
  current,
  reached,
  onSelect,
  locked = false,
  cancel,
  children,
}: {
  steps: Step[];
  current: number;
  reached: number;
  onSelect: (index: number) => void;
  locked?: boolean;
  cancel?: ReactNode;
  children: ReactNode;
}) {
  const navRef = useRef<HTMLElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);

  useEffect(() => {
    const nav = navRef.current;
    const button = nav?.querySelector<HTMLElement>("[aria-current=step]");
    // Only the row's own sideways scroll: scrollIntoView could move the whole page.
    if (nav && button && nav.scrollWidth > nav.clientWidth) {
      nav.scrollTo({ left: button.offsetLeft - (nav.clientWidth - button.offsetWidth) / 2, behavior: "smooth" });
    }
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    bodyRef.current?.focus({ preventScroll: true });
    if (bodyRef.current && bodyRef.current.getBoundingClientRect().top < 0) {
      bodyRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [current]);

  return (
    <div className="flex w-full flex-col gap-6 md:grid md:grid-cols-[13rem_1fr] md:items-start md:gap-10">
      <nav ref={navRef} aria-label="Sections" className="relative -mx-4 overflow-x-auto px-4 md:sticky md:top-24 md:mx-0 md:px-0">
        <ol data-testid="wizard-sections" className="flex gap-2 md:flex-col md:gap-1">
          {steps.map((step, index) => {
            const done = index < reached;
            const active = index === current;
            const open = !locked && index <= reached && !active;
            return (
              <li key={step.key} className="shrink-0">
                <button
                  type="button"
                  disabled={!open}
                  aria-current={active ? "step" : undefined}
                  onClick={() => onSelect(index)}
                  data-testid={`wizard-section-${step.key}`}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-full px-3 py-2 text-left text-sm whitespace-nowrap",
                    "transition-colors duration-300 ease-calm",
                    active && "bg-surface font-semibold text-foreground shadow-soft",
                    open && "hover:bg-mist",
                    !active && !open && "text-muted",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs tabular-nums",
                      "transition-colors duration-300 ease-calm",
                      index <= reached ? "border-primary bg-primary text-white" : "border-line-strong",
                      active && "ring-4 ring-sky-mist",
                    )}
                  >
                    {done && !active ? <TickGlyph className="size-3.5 stroke-[2.6]" /> : index + 1}
                  </span>
                  {step.label}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>
      <Card clip={false} className="min-w-0">
        <CardBody
          pad="lg"
          key={current}
          ref={bodyRef}
          tabIndex={-1}
          role="group"
          aria-label={`Step ${current + 1} of ${steps.length}: ${steps[current]?.label}`}
          className="flex animate-rise scroll-mt-24 flex-col gap-6 outline-none"
        >
          <div className="flex items-center gap-4">
            <div className="flex min-w-0 flex-1 flex-col gap-2.5">
              <p className="text-sm text-muted tabular-nums">
                <span className="font-semibold text-foreground">Step {current + 1}</span> of {steps.length}
              </p>
              <div aria-hidden className="flex gap-1">
                {steps.map((step, index) => (
                  <span
                    key={step.key}
                    className={cn(
                      "h-1.5 flex-1 rounded-full transition-colors duration-500 ease-calm",
                      index <= current ? "bg-primary" : index <= reached ? "bg-fern" : "bg-line",
                    )}
                  />
                ))}
              </div>
            </div>
            {cancel && <div className="-mr-2 shrink-0 self-start">{cancel}</div>}
          </div>
          {children}
        </CardBody>
      </Card>
    </div>
  );
}

// A section's heading: the legend of the wizard's fieldset, or an h2 where there is no form.
export function WizardTitle({ as: Tag = "legend", children }: { as?: "legend" | "h2"; children: ReactNode }) {
  return <Tag className="mb-1 font-display text-3xl leading-tight font-extrabold tracking-tight text-balance">{children}</Tag>;
}

// The wizard's footer (RAA-97): Back at one end and the forward button (Next, Skip for now
// or Save as draft) at the other, so neither is tapped for the other. Cancel lives elsewhere.
// It is an ActionBar at the card's foot that stays in view while a long section scrolls; `next`
// is a `glow` pill Button.
export function WizardActions({ onBack, next }: { onBack?: () => void; next: ReactNode }) {
  return (
    // Without Back (the first section) the bar shrinks to hold just the forward button.
    <ActionBar className={cn(!onBack && "ml-auto w-fit")}>
      {onBack && (
        <Button type="button" variant="glass" size="pill" onClick={onBack} data-testid="listing-back">
          <ArrowGlyph direction="left" className="size-4" />
          Back
        </Button>
      )}
      {next}
    </ActionBar>
  );
}

// The wizard's Next: submits the form, which checks the section before moving on.
export function WizardNext() {
  return (
    <Button type="submit" variant="glow" size="pill" data-testid="listing-next">
      Next
      <ArrowGlyph className="size-4" />
    </Button>
  );
}
