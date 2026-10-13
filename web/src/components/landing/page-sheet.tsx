import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn";
import { glassClasses } from "@/components/ui/glass";

// What a guest page's content sits on over the dark backdrop (RAA-107). The default sheet is
// the hero frame's glass (light text; white cards inside keep dark text) for pages that are one
// thing (a listing, a form, the cart). "clear" leaves the photo showing, for pages made of
// Sections that take turns on the bare photo and on frosted glass, after the banner's own turn
// (.page-sections, globals.css). Inset like
// the banner's frame so the two line up; it fills the rest of the page, so the footer stays at
// the bottom.
export function PageSheet({
  children,
  tone = "sheet",
  className,
}: {
  children: ReactNode;
  tone?: "sheet" | "clear";
  className?: string;
}) {
  return (
    <div className="flex flex-1 flex-col px-3 pb-3 sm:px-6 sm:pb-6">
      <div
        className={cn(
          "mx-auto flex w-full max-w-page flex-1 flex-col",
          tone === "sheet" && cn(glassClasses("sheet"), "rounded-frame sm:px-6"),
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}
