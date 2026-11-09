import { CardLink } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { formatPeso } from "@/lib/money";
import type { PartnerDashboard } from "../use-partner-dashboard";

type Tiles = PartnerDashboard["tiles"];

// The three figures at the top of the dashboard (RAA-284), each opening where the partner acts
// on it. A dot marks the two that ask for something today.
const TILES: { key: keyof Tiles; label: string; href: string; urgent?: "danger" | "warning"; money?: boolean }[] = [
  { key: "requests_waiting", label: "Requests waiting", href: "#booking-requests", urgent: "danger" },
  { key: "arriving_today", label: "Arriving today", href: "/partner/calendar", urgent: "warning" },
  { key: "estimated_earnings_cents", label: "Earnings this month (est.)", href: "/partner/earnings", money: true },
];

export function DashboardTiles({ tiles }: { tiles: Tiles | undefined }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {TILES.map(({ key, label, href, urgent, money }) => {
        const value = tiles?.[key];
        return (
          // On a phone the third tile takes its own row, as two columns leave it alone there.
          <CardLink key={key} href={href} data-testid={`dashboard-tile-${key}`} className={cn("p-5", money && "col-span-2 sm:col-span-1")}>
            <p className="flex items-center gap-2 text-xs text-muted">
              {label}
              {urgent && !!value && (
                <span aria-hidden className={cn("size-2 rounded-full", urgent === "danger" ? "bg-danger" : "bg-warning")} />
              )}
            </p>
            {value === undefined ? (
              <span className="mt-2 block h-8 w-16 animate-pulse rounded-control bg-mist" />
            ) : (
              <p className="mt-1 font-display text-3xl font-bold">{money ? formatPeso(value) : value}</p>
            )}
          </CardLink>
        );
      })}
    </div>
  );
}
