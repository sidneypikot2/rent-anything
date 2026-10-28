import { BagGlyph, PlusGlyph } from "@/components/discovery/tag-glyphs";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/components/ui/cn";

// One trip to pick in a sheet (which trip, move to, merge into): a ticket row (the modal
// redesign) holding a real radio, ringed in the action colour while picked. Callers put the
// options in one <Ticket>. `isNew`: the "New trip" option, with a plus in its well.
export function TripOption({
  checked,
  onSelect,
  title,
  detail,
  suggested = false,
  isNew = false,
}: {
  checked: boolean;
  onSelect: () => void;
  title: string;
  detail: string;
  suggested?: boolean;
  isNew?: boolean;
}) {
  return (
    <label
      className={cn(
        "flex min-h-16 cursor-pointer items-center gap-3 px-3.5 py-3 transition-colors duration-300 ease-calm first:rounded-t-[1.3125rem] last:rounded-b-[1.3125rem]",
        checked ? "bg-action-tint inset-ring-2 inset-ring-action-ink" : "hover:bg-surface-2",
      )}
    >
      <input type="radio" name="trip" checked={checked} onChange={onSelect} className="sr-only" />
      <span
        aria-hidden
        className={cn(
          "flex size-9.5 shrink-0 items-center justify-center rounded-xl text-action-ink",
          checked ? "bg-surface" : isNew ? "bg-tag text-navy" : "bg-action-tint",
        )}
      >
        {isNew ? <PlusGlyph className="size-4.5" /> : <BagGlyph className="size-5" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-control font-bold">
          {title}
          {suggested && (
            <Badge tone="emerald" className="min-h-6 px-2.5 text-xs">
              Suggested
            </Badge>
          )}
        </span>
        <span className="block text-sm text-pretty text-muted">{detail}</span>
      </span>
      <span
        aria-hidden
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-full",
          checked ? "bg-action-ink" : "border-[1.5px] border-line-strong",
        )}
      >
        {checked && <span className="size-2 rounded-full bg-white" />}
      </span>
    </label>
  );
}
