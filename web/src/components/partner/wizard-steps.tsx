import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn";

type Step = { key: string; label: string };

// Adding a listing, laid out as a sidebar of its sections beside the current one (RAA-83).
// On a phone the sections are a row above it that scrolls sideways. A section already
// passed can be opened again; later ones open with Next, so each step's checks run.
export function WizardLayout({
  steps,
  current,
  onSelect,
  children,
}: {
  steps: Step[];
  current: number;
  onSelect: (index: number) => void;
  children: ReactNode;
}) {
  return (
    <div className="flex w-full flex-col gap-6 md:grid md:grid-cols-[13rem_1fr] md:items-start md:gap-10">
      <nav aria-label="Sections" className="-mx-4 overflow-x-auto px-4 md:sticky md:top-24 md:mx-0 md:px-0">
        <ol data-testid="wizard-sections" className="flex gap-2 md:flex-col md:gap-1">
          {steps.map((step, index) => {
            const done = index < current;
            const active = index === current;
            return (
              <li key={step.key} className="shrink-0">
                <button
                  type="button"
                  disabled={!done}
                  aria-current={active ? "step" : undefined}
                  onClick={() => onSelect(index)}
                  data-testid={`wizard-section-${step.key}`}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm whitespace-nowrap",
                    active && "bg-surface-2 font-semibold text-foreground",
                    done && "text-foreground hover:bg-surface-2",
                    !active && !done && "text-muted",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full border-[1.5px] text-xs",
                      index <= current ? "border-primary bg-primary text-white" : "border-line-strong",
                    )}
                  >
                    {done ? "✓" : index + 1}
                  </span>
                  {step.label}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
