import { Badge } from "@/components/ui/badge";
import { cn } from "@/components/ui/cn";
import { BoltGlyph } from "./tag-glyphs";

// The pill on an instant-book listing (RAA-133): guests book it at once, without waiting for
// the partner. Aqua, the highlight tone. `small` for a row's or card's chips.
export function InstantBookBadge({ small = false, className }: { small?: boolean; className?: string }) {
  return (
    <Badge tone="aqua" className={cn(small && "min-h-6 px-2.5 text-xs", className)} data-testid="instant-book-badge">
      <BoltGlyph className={small ? "size-3.5" : "size-4"} />
      Instant book
    </Badge>
  );
}
