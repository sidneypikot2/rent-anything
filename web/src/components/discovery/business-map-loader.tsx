"use client";

import dynamic from "next/dynamic";
import type { LatLng } from "@/lib/map";

// BusinessMap, loaded only in the browser once the page shows it, so MapLibre stays out of the
// page's first load (as AreaMapLayout loads AreaMap).
const BusinessMap = dynamic(() => import("./business-map"), {
  ssr: false,
  loading: () => <div className="h-56 w-full rounded-card bg-mist sm:h-72" />,
});

export function BusinessMapLoader({ point, name }: { point: LatLng; name: string }) {
  return <BusinessMap point={point} name={name} />;
}
