import Image from "next/image";

// The guest pages' one background (RAA-107): the hero photo under the footer's forest tint, dense
// enough everywhere (80% at its lightest) for the white text on the glass above it,
// pinned to the window so banners, content and footer scroll over it. A fixed layer rather
// than background-attachment: fixed, which iOS Safari ignores; lvh, so it doesn't jump when
// a phone's toolbar collapses. The photo is decorative.
export function SiteBackdrop() {
  return (
    <div aria-hidden className="fixed inset-x-0 top-0 -z-10 h-lvh">
      <Image src="/images/hero.jpg" alt="" fill preload sizes="100vw" className="object-cover" />
      <div className="absolute inset-0 bg-linear-to-r from-forest/95 via-forest/90 to-forest/80" />
    </div>
  );
}
