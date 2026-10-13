import Image from "next/image";

// The guest pages' one background (RAA-107): the hero photo in its own colours under a neutral
// dark scrim (RAA-108 dropped the forest tint), dense enough everywhere (50% at its lightest)
// for the white text on the glass above it,
// pinned to the window so banners, content and footer scroll over it. A fixed layer rather
// than background-attachment: fixed, which iOS Safari ignores; lvh, so it doesn't jump when
// a phone's toolbar collapses. The photo is decorative.
export function SiteBackdrop() {
  return (
    <div aria-hidden className="fixed inset-x-0 top-0 -z-10 h-lvh">
      <Image src="/images/hero.jpg" alt="" fill preload sizes="100vw" className="object-cover" />
      <div className="absolute inset-0 bg-linear-to-r from-scrim/70 via-scrim/60 to-scrim/50" />
    </div>
  );
}
