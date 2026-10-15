import Image from "next/image";

// The guest pages' one background (RAA-107): the hero photo in its own colours under a neutral
// dark scrim (RAA-108 dropped the forest tint), dense enough everywhere (65% at its lightest)
// for the white and sky-mist text over it, even on the photo's brightest spots and under the
// glass-frame sections' faint white fill (5:1 there, where 60% gave 4.2:1),
// pinned to the window so banners, content and footer scroll over it. A fixed layer rather
// than background-attachment: fixed, which iOS Safari ignores; lvh, so it doesn't jump when
// a phone's toolbar collapses. Navy stands in until the photo arrives, so the first paint is
// dark under the white text rather than grey. The photo is decorative.
// The home hero shows this photo too, with these sizes: different sizes pick different widths
// from the srcset, and the browser downloads both.
export const BACKDROP_PHOTO = { src: "/images/hero.jpg", sizes: "100vw" };

export function SiteBackdrop() {
  return (
    <div aria-hidden className="fixed inset-x-0 top-0 -z-10 h-lvh bg-navy">
      <Image src={BACKDROP_PHOTO.src} alt="" fill preload sizes={BACKDROP_PHOTO.sizes} className="object-cover" />
      <div className="absolute inset-0 bg-linear-to-r from-scrim/72 via-scrim/68 to-scrim/65" />
    </div>
  );
}
