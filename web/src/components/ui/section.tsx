import type { ReactNode } from "react";
import { cn } from "./cn";
import { Eyebrow, SectionTitle } from "./typography";

// One section of a page, so they all read the same way: an optional eyebrow, the title, an
// optional intro and action, then the content one `block` step below. Sections sit one
// `section` step apart in their page (gap-section). It eases up as it scrolls into view, unless
// it has an `id`: links jump to it and to things in it (#places, #listing-12), and the browser
// aims a jump at where the section is drawn before the jump, 14px low while it is still rising,
// so the heading would land under the header.
// In a .page-sections page, `surface` says what it sits on (RAA-125): the bare photo, the
// faint glass or paper (a pale sheet, for a section of white cards); globals.css draws them.
// An anchor to it (/#destinations) clears the header through html's scroll padding
// (--chrome) alone: a scroll margin here would add to it.
export function Section({
  id,
  testId,
  eyebrow,
  title,
  intro,
  action,
  surface,
  align = "start",
  className,
  children,
}: {
  id?: string;
  testId?: string;
  eyebrow?: ReactNode;
  title: ReactNode;
  intro?: ReactNode;
  action?: ReactNode;
  surface?: "photo" | "glass" | "paper";
  // "center" centres the heading over content that is itself centred (the About page's founders).
  align?: "start" | "center";
  className?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} data-testid={testId} data-surface={surface} className={cn(!id && "reveal", "flex flex-col gap-block", className)}>
      <header className={cn("flex flex-wrap items-end gap-x-6 gap-y-3", align === "center" ? "justify-center text-center" : "justify-between")}>
        <div className={cn("flex max-w-prose flex-col gap-2", align === "center" && "items-center")}>
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
