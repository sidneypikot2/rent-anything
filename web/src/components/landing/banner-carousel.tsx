"use client";

import Image from "next/image";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/components/ui/cn";
import { isApiPhoto } from "./sample-photos";

// How long each photo shows before the next slides in.
export const BANNER_ROTATE_MS = 5000;
// How long a turn's slide takes, and a swipe too short to turn takes to settle back.
const SLIDE_MS = 700;
const SETTLE_MS = 300;
// How long a `fade` carousel's next photo takes to come up over the one before.
const FADE_MS = 1800;
// How far a finger, or a trackpad's two fingers, moves sideways to turn one photo; a quicker
// flick turns it from FLICK_PX.
const SWIPE_PX = 40;
const FLICK_PX = 16;
const FLICK_PX_PER_MS = 0.4;
const WHEEL_PX = 60;

type Photo = { src: string; alt: string };

const easeCalm = () => getComputedStyle(document.documentElement).getPropertyValue("--ease-calm").trim() || "ease-out";
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const slideTo = (frame: HTMLElement, from: number, to: number, duration: number) =>
  frame.animate([{ transform: `translateX(${from}px)` }, { transform: `translateX(${to}px)` }], { duration, easing: easeCalm() });

// A destination's banner with several photos (RAA-211): it opens on the first, and every
// BANNER_ROTATE_MS the next one slides in from the right, each slowly drifting as a single banner
// photo does. It holds still while the banner is off-screen, the tab is hidden, or a pointer or
// keyboard focus (not a click's) is on the banner (someone reading it, or about to tap a chip), and
// never turns by itself under reduced motion. The dots at the top pick a photo, and a swipe across
// the banner turns to the next or previous one: a finger's drags the photo along with it, a
// trackpad's turns one photo per gesture. Every turn slides the same way (SLIDE_MS, `ease-calm`);
// under reduced motion it fades instead. `fade` (the sign-in sheet, RAA-253) never slides: the next
// photo comes up slowly over the shown one (FADE_MS), and a swipe turns it the same way.
// Rendered in a clipped photo layer inside a <section>, which it watches for hovers and swipes
// (PageBanner's, whose top the banner's contents leave clear for the dots). `dots="left"` is for
// a layer whose right side sits under something.
export function BannerCarousel({
  photos,
  sizes,
  className,
  fade = false,
  dots = "right",
}: {
  photos: Photo[];
  sizes: string;
  className?: string;
  fade?: boolean;
  dots?: "left" | "right";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const frames = useRef<(HTMLDivElement | null)[]>([]);
  const [shown, setShown] = useState(0);
  const [paused, setPaused] = useState(false);
  // What the next turn starts from: its direction (1 slides in from the right) and how far a
  // finger had already dragged the photos when it let go.
  const turnFrom = useRef({ dir: 1, drag: 0 });
  const was = useRef(0);
  const current = useRef(0);

  const go = useCallback((to: number, dir: number, drag = 0) => {
    turnFrom.current = { dir, drag };
    setShown(to);
  }, []);

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

  // A turn: the shown photo slides out one width to the side and the next comes in from the
  // other, both from wherever a finger left them. The one going stays visible until it is out.
  useLayoutEffect(() => {
    const from = was.current;
    was.current = current.current = shown;
    const { dir, drag } = turnFrom.current;
    turnFrom.current = { dir: 1, drag: 0 };
    const width = ref.current?.clientWidth ?? 0;
    const incoming = frames.current[shown];
    const outgoing = frames.current[from];
    for (const frame of frames.current) {
      if (!frame) continue;
      for (const animation of frame.getAnimations()) animation.cancel();
      frame.style.transform = "";
      frame.style.visibility = "";
      frame.style.zIndex = "";
    }
    if (from === shown || !incoming || !outgoing) return;
    if (reducedMotion()) {
      incoming.animate([{ opacity: 0 }, { opacity: 1 }], { duration: SETTLE_MS, easing: easeCalm() });
      return;
    }
    outgoing.style.visibility = "visible";
    if (fade) {
      // The shown photo stays solid under the next one, so the window never dims between them.
      // Eased at both ends: `ease-calm` does most of its change early, which reads as a quick cut.
      incoming.style.zIndex = "-19";
      const rising = incoming.animate([{ opacity: 0 }, { opacity: 1 }], { duration: FADE_MS, easing: "ease-in-out" });
      rising.onfinish = rising.oncancel = () => {
        outgoing.style.visibility = "";
        incoming.style.zIndex = "";
      };
      return;
    }
    const leaving = slideTo(outgoing, drag, drag - dir * width, SLIDE_MS);
    leaving.onfinish = leaving.oncancel = () => (outgoing.style.visibility = "");
    slideTo(incoming, drag + dir * width, 0, SLIDE_MS);
  }, [shown, fade]);

  // A sideways swipe on the banner turns one photo. A finger drags the shown photo and the one
  // beside it along (the banner is `touch-pan-y` while it has a carousel, so the page still
  // scrolls under a vertical swipe), then turns or settles back on release. A trackpad's is a
  // stream of wheel events, which is cancelled so the browser doesn't go back a page, and turns one
  // photo per gesture. Neither is taken inside something that scrolls sideways itself (a phone's
  // chip row), and a click that ends a swipe doesn't open a chip.
  useEffect(() => {
    const layer = ref.current;
    const banner = layer?.closest("section");
    if (!layer || !banner) return;
    const count = photos.length;
    const step = (by: number) => (current.current + by + count) % count;
    const inScroller = (target: EventTarget | null) => {
      for (let node = target instanceof Element ? target : null; node && node !== banner; node = node.parentElement) {
        if (node.matches("input, textarea, select")) return true;
        if (node.scrollWidth > node.clientWidth && /auto|scroll/.test(getComputedStyle(node).overflowX)) return true;
      }
      return false;
    };
    let start: { x: number; y: number; at: number } | null = null;
    let dragging = false;
    let beside: HTMLDivElement | null = null;
    // When a swipe ended: the click a browser may send right after it is not a tap.
    let swipedAt = -Infinity;
    const place = (frame: HTMLElement, x: number) => (frame.style.transform = `translateX(${x}px)`);
    const down = (event: PointerEvent) => {
      start = event.pointerType !== "mouse" && event.isPrimary && !inScroller(event.target) ? { x: event.clientX, y: event.clientY, at: event.timeStamp } : null;
      dragging = false;
    };
    const move = (event: PointerEvent) => {
      if (!start || fade || reducedMotion()) return;
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      if (!dragging) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        if (Math.abs(dx) <= Math.abs(dy)) {
          start = null;
          return;
        }
        dragging = true;
        for (const frame of frames.current) for (const animation of frame?.getAnimations() ?? []) animation.finish();
      }
      const width = layer.clientWidth;
      const shownFrame = frames.current[current.current];
      const next = frames.current[step(dx < 0 ? 1 : -1)];
      if (!shownFrame || !next) return;
      if (beside && beside !== next && beside !== shownFrame) {
        beside.style.transform = "";
        beside.style.visibility = "";
      }
      beside = next === shownFrame ? null : next;
      place(shownFrame, dx);
      if (beside) {
        beside.style.visibility = "visible";
        place(beside, dx + (dx < 0 ? width : -width));
      }
    };
    const up = (event: PointerEvent) => {
      if (!start) return;
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      const fast = Math.abs(dx) / Math.max(1, event.timeStamp - start.at) > FLICK_PX_PER_MS;
      start = null;
      if (dragging) swipedAt = event.timeStamp;
      const sideways = Math.abs(dx) > Math.abs(dy);
      if (sideways && (Math.abs(dx) >= SWIPE_PX || (fast && Math.abs(dx) >= FLICK_PX))) {
        swipedAt = event.timeStamp;
        const dir = dx < 0 ? 1 : -1;
        go(step(dir), dir, dragging ? dx : 0);
      } else if (dragging) settle(dx);
      dragging = false;
      beside = null;
    };
    // Too short a drag: both photos slide back to where they were.
    const settle = (dx: number) => {
      const shownFrame = frames.current[current.current];
      if (shownFrame) {
        shownFrame.style.transform = "";
        slideTo(shownFrame, dx, 0, SETTLE_MS);
      }
      const other = beside;
      if (!other) return;
      const side = dx < 0 ? layer.clientWidth : -layer.clientWidth;
      other.style.transform = "";
      const back = slideTo(other, dx + side, side, SETTLE_MS);
      back.onfinish = back.oncancel = () => (other.style.visibility = "");
    };
    const cancel = () => {
      if (dragging) settle(0);
      start = null;
      dragging = false;
      beside = null;
    };
    const click = (event: MouseEvent) => {
      if (event.timeStamp - swipedAt < 400) {
        event.preventDefault();
        event.stopPropagation();
      }
      swipedAt = -Infinity;
    };
    let travelled = 0;
    let spent = false;
    let quiet: ReturnType<typeof setTimeout> | undefined;
    const wheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaX) <= Math.abs(event.deltaY) || inScroller(event.target)) return;
      event.preventDefault();
      clearTimeout(quiet);
      quiet = setTimeout(() => ((travelled = 0), (spent = false)), 250);
      if (spent) return;
      travelled += event.deltaX;
      if (Math.abs(travelled) < WHEEL_PX) return;
      spent = true;
      const dir = travelled > 0 ? 1 : -1;
      go(step(dir), dir);
    };
    banner.addEventListener("pointerdown", down);
    banner.addEventListener("pointermove", move);
    banner.addEventListener("pointerup", up);
    banner.addEventListener("pointercancel", cancel);
    banner.addEventListener("click", click, true);
    banner.addEventListener("wheel", wheel, { passive: false });
    return () => {
      clearTimeout(quiet);
      banner.removeEventListener("pointerdown", down);
      banner.removeEventListener("pointermove", move);
      banner.removeEventListener("pointerup", up);
      banner.removeEventListener("pointercancel", cancel);
      banner.removeEventListener("click", click, true);
      banner.removeEventListener("wheel", wheel);
    };
  }, [photos.length, go, fade]);

  useEffect(() => {
    if (paused || reducedMotion()) return;
    const timer = setTimeout(() => go((shown + 1) % photos.length, 1), BANNER_ROTATE_MS);
    return () => clearTimeout(timer);
  }, [paused, shown, photos.length, go]);

  return (
    // The photos sit under PageBanner's scrim (-z-10): each in its own -z-20 frame, which the
    // slide moves while the photo inside drifts. The layer itself takes no z-index, so the dots,
    // above it, stay over the scrim and can be clicked.
    <div ref={ref} className="absolute inset-0" data-testid="banner-carousel">
      {photos.map((photo, index) => (
        <div
          key={photo.src}
          ref={(frame) => {
            frames.current[index] = frame;
          }}
          className={cn("absolute inset-0 -z-20 will-change-transform", index !== shown && "invisible")}
        >
          <Image
            src={photo.src}
            alt={index === shown ? photo.alt : ""}
            aria-hidden={index !== shown}
            fill
            preload={index === 0}
            // The next photo slides in within seconds, so it loads at once too.
            loading={index === 1 ? "eager" : undefined}
            unoptimized={isApiPhoto(photo.src)}
            sizes={sizes}
            className={cn("object-cover motion-safe:animate-drift", className)}
          />
        </div>
      ))}
      <div className={cn("absolute top-4 z-10 flex gap-1 sm:top-5", dots === "left" ? "left-4 sm:left-6" : "right-4 sm:right-6")} role="group" aria-label="Banner photos">
        {photos.map((photo, index) => (
          <button
            key={photo.src}
            type="button"
            aria-label={`Show photo ${index + 1} of ${photos.length}`}
            aria-current={index === shown}
            onClick={() => index !== shown && go(index, index > shown ? 1 : -1)}
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
