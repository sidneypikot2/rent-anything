import { ChevronGlyph } from "@/components/discovery/tag-glyphs";
import { cn } from "./cn";

// "19–36 of 47".
export function rangeText(page: number, perPage: number, total: number) {
  return `${(page - 1) * perPage + 1}–${Math.min(page * perPage, total)} of ${total}`;
}

export function PageArrow({ direction, disabled, onClick, className }: { direction: "left" | "right"; disabled: boolean; onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={direction === "left" ? "Previous page" : "Next page"}
      className={cn("flex size-11 shrink-0 items-center justify-center rounded-full disabled:opacity-40", className)}
      data-testid={`plan-page-${direction === "left" ? "prev" : "next"}`}
    >
      <ChevronGlyph direction={direction} className="size-5" />
    </button>
  );
}

// The pages a pager offers: the first, the last, and the current one with its neighbours, with a
// gap (null) where pages are skipped: 1 … 4 5 6 … 12.
function pageList(page: number, pages: number): (number | null)[] {
  const wanted = new Set([1, pages, page - 1, page, page + 1].filter((each) => each >= 1 && each <= pages));
  const sorted = [...wanted].sort((a, b) => a - b);
  return sorted.flatMap((each, index) => (index > 0 && each - sorted[index - 1] > 1 ? [null, each] : [each]));
}

// Under a list's options (a plan step's, a What to book section's), once they run past a page
// (Airbnb's): ‹ 1 2 3 … › and which of them show ("1–18 of 47"). Nothing while they fit on one.
export function Pager({ page, perPage, total, onPage }: { page: number; perPage: number; total: number; onPage: (page: number) => void }) {
  const pages = Math.ceil(total / perPage);
  if (pages <= 1) return null;
  return (
    <nav aria-label="Pages of options" className="flex flex-col items-center gap-2 pt-2" data-testid="plan-pager">
      <div className="flex items-center gap-1">
        <PageArrow direction="left" disabled={page <= 1} onClick={() => onPage(page - 1)} className="text-navy hover:bg-mist" />
        {pageList(page, pages).map((each, index) =>
          each === null ? (
            <span key={`gap-${index}`} aria-hidden className="w-6 text-center text-muted">
              …
            </span>
          ) : (
            <button
              key={each}
              type="button"
              onClick={() => onPage(each)}
              aria-current={each === page ? "page" : undefined}
              aria-label={`Page ${each}`}
              className={cn(
                "flex size-11 items-center justify-center rounded-full text-sm font-semibold tabular-nums transition-colors duration-300 ease-calm",
                each === page ? "bg-navy text-white" : "text-navy hover:bg-mist",
              )}
            >
              {each}
            </button>
          ),
        )}
        <PageArrow direction="right" disabled={page >= pages} onClick={() => onPage(page + 1)} className="text-navy hover:bg-mist" />
      </div>
      <p className="text-sm text-muted tabular-nums">{rangeText(page, perPage, total)}</p>
    </nav>
  );
}
