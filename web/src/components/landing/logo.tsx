import { cn } from "@/components/ui/cn";
import { BRAND_PARTS } from "@/lib/brand";

// The wordmark: "TripKo" in white, "Next" in pale blue, both extra-bold. For navy
// backgrounds (header, footer), where aqua has the contrast.
export function Logo({ className }: { className?: string }) {
  const [first, second] = BRAND_PARTS;
  return (
    <span className={cn("font-display font-extrabold tracking-tight text-white", className)}>
      {first}
      <span className="text-aqua">{second}</span>
    </span>
  );
}
