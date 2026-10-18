// The photo cards' shared classes, in a plain module: a "use client" file's exports reach a
// Server Component as client references, not strings, so these can't live in photo-card.tsx.

// Every photo card shares this frame (Sky & Forest, RAA-102): the photo fills a card-radius
// box with the soft shadow; on hover the card rises, the photo staying still. The content
// sits on glass 12px in, at the control radius (the card's 24px less the inset). The card edge's
// frosted rim shows the backdrop around the photo.
export const PHOTO_CARD =
  "card-edge group relative isolate overflow-hidden rounded-card shadow-soft transition-[transform,box-shadow] duration-500 ease-calm motion-safe:hover:-translate-y-1 hover:shadow-lift";
export const PHOTO_CARD_IMAGE = "-z-20 object-cover object-[50%_70%]";
export const PHOTO_SCRIM = "absolute inset-0 -z-10 bg-linear-to-b from-transparent via-transparent to-scrim/55";

// A title link that covers the whole card. The card clips its content, so the focus ring is
// drawn inside its edge.
export const STRETCHED_LINK =
  "outline-none after:absolute after:inset-0 after:rounded-card after:content-[''] focus-visible:after:outline-2 focus-visible:after:-outline-offset-4 focus-visible:after:outline-(--focus)";
