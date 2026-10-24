import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn";
import { glassClasses } from "@/components/ui/glass";

// What a guest page's content sits on over the dark backdrop (RAA-107). The default sheet is
// the hero frame's glass (light text; white cards inside keep dark text) for pages that are one
// thing (a listing, a form, the cart). "clear" leaves the photo showing, for pages made of
// Sections that take turns on the bare photo and on frosted glass, after the banner's own turn
// (.page-sections, globals.css). Inset like
// the banner's frame so the two line up; it fills the rest of the page, so the footer stays at
// the bottom. "paper" is a white sheet with dark text, for the partner and admin pages, which
// are work screens rather than browsing (RAA-120, RAA-142). `wide` lets what's inside go past
// the page width, for the admin console's dense tables.
export function PageSheet({
  children,
  tone = "sheet",
  wide = false,
  className,
}: {
  children: ReactNode;
  tone?: "sheet" | "clear" | "paper";
  wide?: boolean;
  className?: string;
}) {
  return (
    <div className="flex flex-1 flex-col px-2 pb-2 sm:px-6 sm:pb-6">
      <div
        className={cn(
          "mx-auto flex w-full flex-1 flex-col",
          wide ? "max-w-split" : "max-w-page",
          tone === "sheet" && cn(glassClasses("sheet"), "rounded-frame sm:px-6"),
          tone === "paper" && "card-edge rounded-frame bg-surface px-3 text-foreground shadow-float sm:px-6",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}
