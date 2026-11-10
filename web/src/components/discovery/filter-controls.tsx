import { Button } from "@/components/ui/button";
import { CloseGlyph, FilterGlyph } from "./tag-glyphs";

// The Filter button by a section's title (What to book, a plan step): a labelled button (a bare
// icon circle went unnoticed in testing), the outlined second action, tinted while filters are set
// (data-set, globals.css), with how many are set in a badge on its corner.
export function FilterButton({ title, set, onClick, testId }: { title: string; set: number; onClick: () => void; testId: string }) {
  return (
    <Button
      variant="soft"
      size="touch"
      aria-label={`Filter ${title}${set > 0 ? `, ${set} set` : ""}`}
      aria-haspopup="dialog"
      onClick={onClick}
      data-testid={testId}
      data-set={set > 0 || undefined}
      className="shrink-0 px-4 text-control"
    >
      <FilterGlyph className="size-5" />
      Filter
      {set > 0 && (
        <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs font-bold text-white tabular-nums">
          {set}
        </span>
      )}
    </Button>
  );
}

// One filter that is set, as a pill that removes it.
export function FilterPill({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="flex min-h-8 items-center gap-1 rounded-full bg-mist pr-1 pl-3 text-xs font-semibold whitespace-nowrap text-primary">
      {label}
      <button
        type="button"
        aria-label={`Remove ${label}`}
        onClick={onRemove}
        // A 24px circle with a 44px-tall hit area, so the pill stays slim on a phone.
        className="relative flex size-6 items-center justify-center rounded-full before:absolute before:-inset-x-1.5 before:-inset-y-2.5 hover:bg-surface"
      >
        <CloseGlyph className="size-3.5" />
      </button>
    </span>
  );
}

// A price range as a pill says it: "₱500–₱1,500", "Up to ₱1,500", "From ₱500" (whole pesos).
export function priceRangeLabel(min: number, max: number, peso: (pesos: number) => string) {
  return min && max ? `${peso(min)}–${peso(max)}` : max ? `Up to ${peso(max)}` : `From ${peso(min)}`;
}
