import { Badge } from "@/components/ui/badge";
import { cn } from "@/components/ui/cn";

// One trip to pick in a sheet (which trip, move to, merge into): a radio as a card.
export function TripOption({
  checked,
  onSelect,
  title,
  detail,
  suggested = false,
}: {
  checked: boolean;
  onSelect: () => void;
  title: string;
  detail: string;
  suggested?: boolean;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-xl border-[1.5px] p-3",
        checked ? "border-primary bg-mist" : "border-line-strong bg-surface",
      )}
    >
      <input type="radio" name="trip" checked={checked} onChange={onSelect} className="mt-1 accent-primary" />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2 font-semibold">
          {title}
          {suggested && <Badge tone="emerald">Suggested</Badge>}
        </span>
        <span className="block text-sm text-muted">{detail}</span>
      </span>
    </label>
  );
}
