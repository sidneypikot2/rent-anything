import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn";
import { GlassPanel, glassClasses } from "@/components/ui/glass";
import { DriftingPhoto } from "./drifting-photo";
import { HEADER_PULL } from "./section-header";

// `sizes` defaults to the frame's width; a photo also shown elsewhere passes that one's.
type Photo = { src: string; alt: string; mirror?: boolean; sizes?: string };

// The home hero's frame. A short phone tightens it so the search and the way in stay on the
// first screen; a phone on its side has no height for a stack, so the title takes the left
// column and the hero's actions the right.
// Its padding is separate: on a photo (HERO_PHOTO_PAD) a phone gets a strip of clear water above
// the contents, which a short phone gives up.
const HERO_FRAME =
  "gap-block max-sm:short:gap-4 landscape-phone:grid landscape-phone:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] landscape-phone:content-center landscape-phone:gap-x-8";
const HERO_GLASS_PAD = "pb-8 pt-10 max-sm:short:pb-6 max-sm:short:pt-6 sm:pb-10 sm:pt-16 landscape-phone:py-6";
const HERO_PHOTO_PAD = "pb-8 pt-24 max-sm:short:pb-6 max-sm:short:pt-6 sm:pb-12 sm:pt-16 landscape-phone:py-6";

// The top of a main page (Sky & Forest, RAA-102): the page's eyebrow, title, intro and
// actions in white on a glass frame, over the guest pages' fixed backdrop (RAA-107).
// `hero` is the home page's taller one; pass `frameClass` for the frame's own spacing.
// With a `photo` (RAA-108) the frame shows it, slowly drifting, under a scrim that darkens its
// foot, and the contents sit at the bottom on that scrim instead of on glass: the page opens
// on the place rather than on the tinted backdrop.
// The home hero's photo is the backdrop's own, at full colour: its scrim darkens only where the
// text is, the foot on a phone and the left from sm up, so the boats show on the right. `mirror`
// flips a photo whose open side is on the wrong side for the text; it is the `scale` property,
// so it composes with the drift's transform.
export function PageBanner({
  eyebrow,
  title,
  children,
  hero = false,
  photo,
  frameClass,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  children?: ReactNode;
  hero?: boolean;
  photo?: Photo;
  frameClass?: string;
}) {
  const contents = (
    <>
      <div className={cn("flex max-w-prose flex-col gap-4 text-white", hero && "max-sm:short:gap-3 landscape-phone:row-span-2 landscape-phone:gap-3")}>
        {eyebrow && (
          <span className={cn(glassClasses("dark"), "self-start rounded-full px-3.5 py-1.5 text-sm font-semibold")}>
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
    // Pulled up under the floating header, with room at the top so the frame clears it. z-10
    // keeps the hero search's suggestions, which open past the frame's foot, over the page
    // sheet that follows (its glass sections are stacking contexts); the header is z-40.
    <section className={cn("focus-light relative isolate z-10 flex px-3 pb-3 pt-20 sm:px-6 sm:pb-6 sm:pt-22", HEADER_PULL)}>
      {photo ? (
        <div
          className={cn(
            "card-edge relative isolate mx-auto flex w-full max-w-page flex-col justify-end rounded-frame px-5 text-white shadow-float sm:px-12",
            // On a phone the contents set the height, so the hero's search and pills stay on the first screen.
            hero
              ? "sm:min-h-[min(86svh,50rem)] landscape-phone:min-h-0"
              : "gap-6 pb-8 pt-24 sm:min-h-[min(60svh,34rem)] sm:pt-32 sm:pb-10",
            frameClass,
          )}
        >
          {/* The photo and its scrim are clipped on their own layer, not the frame, so the
              hero search's suggestions can open past the frame's foot. */}
          <div className="absolute inset-0 -z-10 overflow-hidden rounded-[inherit]">
            <DriftingPhoto
              src={photo.src}
              alt={photo.alt}
              sizes={photo.sizes ?? "(min-width: 72rem) 72rem, 100vw"}
              className={cn("-z-20 object-cover", photo.mirror && "-scale-x-100")}
            />
            {hero ? (
              // A strip of clear water above the contents on a phone; a short one has no strip, so
              // the title starts near the top and the scrim stays dense up there. From sm up the
              // contents sit at the bottom left, under a scrim dense enough for sky-mist text that
              // fades out towards the top, so the water is clear above them too.
              <div
                aria-hidden
                className="absolute inset-0 -z-10 bg-linear-to-t from-scrim/90 via-scrim/78 via-72% to-scrim/10 max-sm:short:to-scrim/60 sm:bg-linear-to-r sm:from-scrim/90 sm:via-scrim/76 sm:via-52% sm:to-scrim/0 sm:mask-t-from-65% sm:mask-t-to-100% landscape-phone:from-scrim/90 landscape-phone:via-scrim/82 landscape-phone:to-scrim/70 landscape-phone:mask-none"
              />
            ) : (
              // Darkest at the foot, where the text is; the top of the photo stays clear.
              <div aria-hidden className="absolute inset-0 -z-10 bg-linear-to-t from-scrim/85 via-scrim/45 to-scrim/5" />
            )}
          </div>
          <div
            className={cn(
              "flex flex-col",
              hero ? cn(HERO_FRAME, HERO_PHOTO_PAD) : "gap-6",
              stagger,
            )}
          >
            {contents}
          </div>
        </div>
      ) : (
        <GlassPanel
          tone="frame"
          className={cn(
            "mx-auto flex w-full max-w-page flex-col rounded-frame px-5 sm:px-12",
            stagger,
            hero ? cn(HERO_FRAME, HERO_GLASS_PAD) : "gap-6 pb-8 pt-10 sm:pb-10 sm:pt-12",
            frameClass,
          )}
        >
          {contents}
        </GlassPanel>
      )}
    </section>
  );
}
