import type { ReactNode } from "react";
import { cn } from "./cn";
import { Eyebrow, SectionTitle } from "./typography";

// One section of a page, so they all read the same way: an optional eyebrow, the title, an
// optional intro and action, then the content one `block` step below. Sections sit one
// `section` step apart in their page (gap-section). It eases up as it scrolls into view.
export function Section({
  id,
  testId,
  eyebrow,
  title,
  intro,
  action,
  className,
  children,
}: {
  id?: string;
  testId?: string;
  eyebrow?: ReactNode;
  title: ReactNode;
  intro?: ReactNode;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} data-testid={testId} className={cn("reveal flex scroll-mt-28 flex-col gap-block", className)}>
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="flex max-w-prose flex-col gap-2">
          {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
          <SectionTitle>{title}</SectionTitle>
          {intro && <p className="text-pretty text-muted">{intro}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}
