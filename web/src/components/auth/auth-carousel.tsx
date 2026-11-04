"use client";

import { useSyncExternalStore } from "react";
import { BannerCarousel } from "@/components/landing/banner-carousel";

// Stand-ins until the team picks its own: the port is Bantayan, the other two are samples.
const PHOTOS = [
  { src: "/images/bantayan-port.jpg", alt: "The port and reef at Bantayan Island, from the air" },
  { src: "/images/samples/cottages.jpg", alt: "Sample photo: beach cottages" },
  { src: "/images/samples/snorkeling.jpg", alt: "Sample photo: snorkeling" },
];

// Tailwind's lg.
const WIDE = "(min-width: 64rem)";

function subscribe(onChange: () => void) {
  const query = window.matchMedia(WIDE);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

// The photos beside the sign-in sheet (RAA-253), a layer of AuthSheet's frame from its left edge to
// 2rem in under the 27rem sheet, whose corners show over them; they are clipped here, so a turn
// never crosses it. Only mounted from lg rather than hidden in CSS, so a phone never loads them.
export function AuthCarousel() {
  const wide = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(WIDE).matches,
    () => false,
  );
  if (!wide) return null;

  return (
    <section aria-label="Photos" className="absolute inset-y-0 right-95 left-0 isolate touch-pan-y touch-pinch-zoom overflow-hidden">
      <BannerCarousel photos={PHOTOS} sizes="47rem" fade dots="left" />
    </section>
  );
}
