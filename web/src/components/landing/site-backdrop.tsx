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
// from the srcset, and the browser downloads both. `placeholder` is the photo at 8×4, which the
// browser blurs and shows until the photo arrives, so the hero opens on the sea's colours
// rather than a black frame. The photo is Bantayan Island's own lagoon and village.
export const BACKDROP_PHOTO = {
  src: "/images/bantayan-port.jpg",
  sizes: "100vw",
  placeholder:
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAECAIAAAA8r+mnAAAAAXNSR0IArs4c6QAAAERlWElmTU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAACKADAAQAAAABAAAABAAAAABQdJZTAAAAb0lEQVQIHQFkAJv/AWyr5fn+APr+//oAAgYD/goD/gUCAAcB+wSl1NsUEPsh/uMG790bAOwH/uwIAwj19PMD+RY57efs4vwB7A4NCRkWAw0QDg8PAwT+BAHp5QD+//zrBOwXDrr8FAAWFQz69hf9Eh1oLJOTI/izAAAAAElFTkSuQmCC" as const,
};

export function SiteBackdrop() {
  return (
    <div aria-hidden className="fixed inset-x-0 top-0 -z-10 h-lvh bg-navy">
      <BackdropLayers />
    </div>
  );
}

function BackdropLayers() {
  return (
    <>
      <Image src={BACKDROP_PHOTO.src} alt="" fill preload sizes={BACKDROP_PHOTO.sizes} placeholder={BACKDROP_PHOTO.placeholder} className="object-cover" />
      <div className="absolute inset-0 bg-linear-to-r from-scrim/72 via-scrim/68 to-scrim/65" />
    </>
  );
}

// The backdrop again, from the window's top down to the header's middle (--chrome is its foot
// plus 12px, and it starts 12px down), laid over the page under the header: what scrolls up is
// cut off at the header rather than showing in the gap above it. The middle, where the bar is
// widest, so the cut meets its sides and the page slides under its lower curve; cut at its foot,
// the page's straight edge met the round ends. Lined up with SiteBackdrop: the same photo.
export function BackdropStrip() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[calc(var(--chrome)/2)] overflow-hidden bg-navy">
      <div className="absolute inset-x-0 top-0 h-lvh">
        <BackdropLayers />
      </div>
    </div>
  );
}
