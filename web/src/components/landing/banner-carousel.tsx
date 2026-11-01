"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/components/ui/cn";
import { isApiPhoto } from "./sample-photos";

// How long each photo shows before the next fades in.
export const BANNER_ROTATE_MS = 6000;

type Photo = { src: string; alt: string };

// A destination's banner with several photos (RAA-211): it opens on the first, and every
// BANNER_ROTATE_MS the next one fades in over it, slowly drifting as a single banner photo does.
// It holds still while the banner is off-screen, the tab is hidden, or a pointer or keyboard
// focus (not a click's) is on the banner (someone reading it, or about to tap a chip), and never turns by itself
// under reduced motion; the dots at the top pick a photo. Rendered in PageBanner's clipped photo
// layer, whose top the banner's contents leave clear for the dots.
export function BannerCarousel({ photos, sizes, className }: { photos: Photo[]; sizes: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const layer = ref.current;
    const banner = layer?.closest("section");
    if (!layer || !banner) return;
    let visible = true;
    let held = false;
    const update = () => setPaused(!visible || held || document.hidden);
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      update();
      for (const image of layer.querySelectorAll("img")) image.style.animationPlayState = visible ? "" : "paused";
    });
    observer.observe(layer);
    // Keyboard focus holds it, not a click: a dot clicked with a mouse keeps focus, and the
    // banner should turn again once the pointer leaves.
    const hold = () => ((held = true), update());
    const release = () => ((held = banner.matches(":hover") || banner.querySelector(":focus-visible") !== null), update());
    const focus = (event: FocusEvent) => (event.target instanceof Element && event.target.matches(":focus-visible") ? hold() : undefined);
    banner.addEventListener("pointerenter", hold);
    banner.addEventListener("pointerleave", release);
    banner.addEventListener("focusin", focus);
    banner.addEventListener("focusout", release);
    document.addEventListener("visibilitychange", update);
    return () => {
      observer.disconnect();
      banner.removeEventListener("pointerenter", hold);
      banner.removeEventListener("pointerleave", release);
      banner.removeEventListener("focusin", focus);
      banner.removeEventListener("focusout", release);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  useEffect(() => {
    if (paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setTimeout(() => setShown((index) => (index + 1) % photos.length), BANNER_ROTATE_MS);
    return () => clearTimeout(timer);
  }, [paused, shown, photos.length]);

  return (
    // The photos sit under PageBanner's scrim (-z-10); the layer itself takes no z-index, so the
    // dots, above it, stay over the scrim and can be clicked.
    <div ref={ref} className="absolute inset-0" data-testid="banner-carousel">
      {photos.map((photo, index) => (
        <Image
          key={photo.src}
          src={photo.src}
          alt={index === shown ? photo.alt : ""}
          aria-hidden={index !== shown}
          fill
          preload={index === 0}
          // The next photo fades in over the first within seconds, so it loads at once too.
          loading={index === 1 ? "eager" : undefined}
          unoptimized={isApiPhoto(photo.src)}
          sizes={sizes}
          className={cn(
            "-z-20 object-cover transition-opacity duration-900 ease-calm motion-safe:animate-drift",
            index === shown ? "opacity-100" : "opacity-0",
            className,
          )}
        />
      ))}
      <div className="absolute right-4 top-4 z-10 flex gap-1 sm:right-6 sm:top-5" role="group" aria-label="Banner photos">
        {photos.map((photo, index) => (
          <button
            key={photo.src}
            type="button"
            aria-label={`Show photo ${index + 1} of ${photos.length}`}
            aria-current={index === shown}
            onClick={() => setShown(index)}
            className="group grid size-6 place-items-center rounded-full"
          >
            <span
              className={cn(
                "block h-1.5 rounded-full bg-white shadow-xs transition-all duration-300 ease-calm",
                index === shown ? "w-5" : "w-1.5 opacity-60 group-hover:opacity-90",
              )}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
