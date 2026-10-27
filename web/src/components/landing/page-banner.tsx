import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn";
import { GlassPanel, glassClasses } from "@/components/ui/glass";
import { DriftingPhoto } from "./drifting-photo";
import { SearchBar } from "./search-bar";

// A banner's row of chips (an area's counts, a trip's needs): one row to swipe on a phone, so the
// banner stays short; its right edge fades, so a chip cut there reads as more to swipe to, and the
// end padding lets the last one clear it. From sm it wraps. `relative` holds a chip's sr-only
// text (absolutely positioned) inside the row, which would otherwise widen the page on a phone.
export const CHIP_ROW =
  "relative -mx-1 flex gap-2 overflow-x-auto pr-8 pl-1 [scrollbar-width:none] max-sm:[mask-image:linear-gradient(to_right,black_calc(100%-2rem),transparent)] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0";
// A count on the banner ("20 to book"), on glass.
export const STAT_CHIP = "flex min-h-11 items-center gap-1.5 rounded-control px-3.5 text-sm whitespace-nowrap text-sky-mist";

export function StatCount({ count }: { count: number }) {
  return <span className="font-display text-xl font-extrabold tabular-nums text-white">{count}</span>;
}

// `sizes` defaults to the frame's width; a photo also shown elsewhere passes that one's.
type Photo = { src: string; alt: string; mirror?: boolean; sizes?: string; placeholder?: `data:image/${string}` };

// The home hero's frame. A short phone tightens it so the search and the way in stay on the
// first screen; a phone on its side has no height for a stack, so the title takes the left
// column and the hero's actions the right.
// Its padding is separate: on a photo (HERO_PHOTO_PAD) it gets a strip of clear water above
// the contents, deeper on a desktop, which a short phone gives up. A short phone is under
// `fold`'s height too, and `fold` comes later in the stylesheet, so the short top padding is
// marked important to win.
const HERO_FRAME =
  "gap-block max-sm:short:gap-3 fold:gap-3 landscape-phone:grid landscape-phone:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] landscape-phone:content-center landscape-phone:gap-x-8";
const HERO_GLASS_PAD = "pb-8 pt-10 max-sm:short:pb-6 max-sm:short:pt-6! sm:pb-10 sm:pt-12 fold:pt-8 landscape-phone:py-6";
const HERO_PHOTO_PAD = "pb-8 pt-16 max-sm:short:pb-5 max-sm:short:pt-5! sm:py-12 lg:pt-28 fold:py-8 landscape-phone:py-6";

// The top of a main page (Sky & Forest, RAA-102): the page's eyebrow, title, intro and
// actions in white on a glass frame, over the guest pages' fixed backdrop (RAA-107).
// `hero` is the home page's taller one; pass `frameClass` for the frame's own spacing.
// With a `photo` (RAA-108) the frame shows it, slowly drifting, under a scrim that darkens its
// foot, and the contents sit at the bottom on that scrim instead of on glass: the page opens
// on the place rather than on the tinted backdrop.
// The home hero's photo is the backdrop's own, at full colour: its scrim darkens only where the
// text is, the foot on a phone and the left from sm up, so the boats show on the right. `mirror`
// flips a photo whose open side is on the wrong side for the text; it is the `scale` property,
// so it composes with the drift's transform. `search={false}` leaves the header's search off the
// page (SearchBar marks a page that has it), for a page that isn't about finding a place (the cart). `compact` is a work page's banner (the
// cart, Trips, Bookings): no photo, the title and its actions on one short row (never wrapping on a
// phone, RAA-161), so the page's own content starts in the first screen.
export function PageBanner({
  eyebrow,
  title,
  children,
  hero = false,
  photo,
  frameClass,
  aside,
  search = true,
  compact = false,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  children?: ReactNode;
  hero?: boolean;
  photo?: Photo;
  frameClass?: string;
  // A card beside the contents from xl (the home hero's example trip, RAA-125), at the foot of
  // the frame: at lg it would squeeze the search beside it. Only with a photo.
  aside?: ReactNode;
  search?: boolean;
  compact?: boolean;
}) {
  const contents = (
    <>
      <div className={cn("flex min-w-0 max-w-prose flex-col gap-4 text-white", hero && "max-sm:short:gap-3 landscape-phone:row-span-2 landscape-phone:gap-3")}>
        {eyebrow && (
          // A mint dot leads it, as on the trust ticks (RAA-130): something is live here.
          // `card` glass: it sits at the top of the photo, where the scrim is lightest, and
          // sky-mist text on `dark` falls near 3:1 over bright water.
          <span
            className={cn(
              glassClasses("card"),
              "flex items-center gap-2 self-start rounded-full px-3.5 py-1.5 text-sm font-semibold",
            )}
          >
            <span aria-hidden className="size-2 shrink-0 rounded-full bg-mint" />
            {eyebrow}
          </span>
        )}
        {title}
      </div>
      {children}
    </>
  );
  // The frame's contents ease up one after another.
  const stagger =
    "*:animate-rise [&>*:nth-child(2)]:stagger-1 [&>*:nth-child(3)]:stagger-2 [&>*:nth-child(n+4)]:stagger-3";

  return (
    // Starts just under the floating header, 12px below it like the gap the header keeps from
    // the window's edge (RAA-125), so the bar never sits on the frame. z-10 keeps the hero
    // search's suggestions, which open past the frame's foot, over the page sheet that follows
    // (its glass sections are stacking contexts); the header is z-40. Every banner but the
    // hero, which holds the search itself, marks its page for the header's search (RAA-126).
    <>
    <section className={cn("focus-light relative isolate z-10 flex px-2 pb-2 pt-3 sm:px-6", compact ? "sm:pb-4" : "sm:pb-6")}>
      {photo ? (
        <div
          className={cn(
            "card-edge relative isolate mx-auto flex w-full max-w-page flex-col justify-end rounded-frame px-inset text-white shadow-float",
            // The contents set a page's banner's height, so it fits the first screen with room for
            // what follows to show (RAA-125), and so does the hero's on a phone, where the
            // spare height of a full screen would all sit over the title. From sm the hero fills
            // the first screen, from under the header (72px) to its own margin (24px), so the page
            // opens on the place alone; taller contents still grow it. On a tablet its contents
            // sit at the foot, under the photo; from lg, with the example trip beside them, they
            // sit in the middle, so a tall window's spare height is shared above and below them
            // rather than all left over the title. A centred stack on a portrait tablet floats
            // over an empty foot. From lg the frame stops at 38rem, a little over its contents, so
            // a full-screen desktop window doesn't leave wide bands of empty photo around them.
            hero
              ? "sm:min-h-[calc(100svh-6.75rem)] lg:min-h-[min(calc(100svh-6.75rem),38rem)] lg:justify-center"
              : "gap-5 pb-7 pt-16 sm:pt-20 fold:gap-4 fold:pt-12",
            frameClass,
          )}
        >
          {/* The photo and its scrim are clipped on their own layer, not the frame, so the
              hero search's suggestions can open past the frame's foot. The hero's photo keeps its
              top, the boats and open water, and crops the rocks at its foot. */}
          <div className="absolute inset-0 -z-10 overflow-hidden rounded-[inherit]">
            <DriftingPhoto
              src={photo.src}
              alt={photo.alt}
              placeholder={photo.placeholder}
              sizes={photo.sizes ?? "(min-width: 72rem) 72rem, 100vw"}
              className={cn("-z-20 object-cover", hero && "object-top", photo.mirror && "-scale-x-100")}
            />
            {hero ? (
              // Clear water above the contents below lg; a short phone has no strip, so the title
              // starts near the top and the scrim stays dense up there. From lg the contents sit on
              // the left, under a scrim dense enough for sky-mist text that fades out towards the
              // right and the top, so the boats show beside them and the water above.
              <div
                aria-hidden
                className="absolute inset-0 -z-10 bg-linear-to-t from-scrim/90 via-scrim/78 via-72% to-scrim/10 max-sm:short:to-scrim/60 lg:bg-linear-to-r lg:from-scrim/90 lg:via-scrim/76 lg:via-52% lg:to-scrim/0 lg:mask-t-from-65% lg:mask-t-to-100% landscape-phone:from-scrim/90 landscape-phone:via-scrim/82 landscape-phone:to-scrim/70 landscape-phone:mask-none"
              />
            ) : (
              // Darkest at the foot, where the text is; the top of the photo stays clear.
              <div aria-hidden className="absolute inset-0 -z-10 bg-linear-to-t from-scrim/85 via-scrim/45 to-scrim/5" />
            )}
          </div>
          <div
            className={cn(
              Boolean(aside) && "xl:grid xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-end xl:gap-10",
              hero && HERO_PHOTO_PAD,
            )}
          >
            <div className={cn("flex flex-col", hero ? HERO_FRAME : "gap-5 fold:gap-4", stagger)}>{contents}</div>
            {aside && <div className="hidden animate-rise stagger-3 xl:block">{aside}</div>}
          </div>
        </div>
      ) : (
        <GlassPanel
          tone="frame"
          className={cn(
            "mx-auto flex w-full max-w-page flex-col rounded-frame px-inset",
            stagger,
            hero
              ? cn(HERO_FRAME, HERO_GLASS_PAD)
              : compact
                ? "flex-row items-center justify-between gap-3 py-3 max-sm:px-3 sm:flex-wrap sm:py-6"
                : "gap-6 pb-8 pt-10 sm:pb-10 sm:pt-12",
            frameClass,
          )}
        >
          {contents}
        </GlassPanel>
      )}
    </section>
    {!hero && search && <SearchBar />}
    </>
  );
}
