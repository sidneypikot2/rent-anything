import { cn } from "@/components/ui/cn";

// The wordmark: "Trip" in the display italic, "inas" upright in aqua. For navy
// backgrounds (header, footer), where aqua has the contrast.
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("font-display font-bold italic text-white", className)}>
      Trip<span className="not-italic text-aqua">inas</span>
    </span>
  );
}
