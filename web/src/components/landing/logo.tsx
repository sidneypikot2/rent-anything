import { cn } from "@/components/ui/cn";
import { BRAND_PARTS } from "@/lib/brand";

// The wordmark: "TripKo" in the display italic, "Next" upright in aqua. For navy
// backgrounds (header, footer), where aqua has the contrast.
export function Logo({ className }: { className?: string }) {
  const [first, second] = BRAND_PARTS;
  return (
    <span className={cn("font-display font-bold italic text-white", className)}>
      {first}
      <span className="not-italic text-aqua">{second}</span>
    </span>
  );
}
