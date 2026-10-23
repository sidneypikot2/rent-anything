"use client";

import { useSyncExternalStore } from "react";

// One bar at the window's foot for an area page's floating buttons (the phone's Map), so
// any that join it sit side by side rather than as separate pills over each other. Each portals
// into it (useFloatingDock) and sets its place with `order`. It's on the body, as a glass blur
// above it would make it fixed to that element, not the window.
// It stays out of the way on the first screen, where What to book's chips sit at the foot and the
// banner already holds the trip: it rises once What to book reaches the window's upper half, and
// stays up while the full-screen map is open (setDockPinned), as its List button is the way back.
// Hidden, it is only out of sight: the keyboard still reaches it (last on the page, or through
// MapSkipLink near What to book), and focus inside brings it up.
const DOCK_CLASS =
  "pointer-events-none fixed inset-x-0 bottom-[calc(1.25rem+env(safe-area-inset-bottom))] z-[60] flex justify-center gap-2 px-4 transition-[opacity,translate] duration-500 ease-calm data-hidden:not-focus-within:translate-y-4 data-hidden:not-focus-within:opacity-0 sm:justify-end sm:px-6 [&>*]:pointer-events-auto data-hidden:not-focus-within:[&>*]:pointer-events-none";

let dock: HTMLDivElement | null = null;
let pinned = false;
let frame = 0;

function update() {
  frame = 0;
  if (!dock) return;
  const section = document.getElementById("listings");
  const hidden = !pinned && section !== null && section.getBoundingClientRect().top > window.innerHeight / 2;
  dock.toggleAttribute("data-hidden", hidden);
  // Room for it at the window's foot, which a toast keeps clear (Toast).
  document.documentElement.style.setProperty("--dock-space", !hidden && dock.childElementCount > 0 ? "4.5rem" : "0px");
}

function schedule() {
  if (!frame) frame = requestAnimationFrame(update);
}

function getDock() {
  if (dock?.isConnected) return dock;
  dock = document.createElement("div");
  dock.id = "floating-dock";
  dock.className = DOCK_CLASS;
  document.body.append(dock);
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);
  // Once its buttons are in, so a page that loads scrolled down shows them at once.
  new MutationObserver(schedule).observe(dock, { childList: true });
  update();
  return dock;
}

const noSubscribe = () => () => {};

// The dock to portal a floating button into; null on the server and in the first render.
export function useFloatingDock() {
  return useSyncExternalStore(noSubscribe, getDock, () => null);
}

// Keeps the dock up whatever the scroll (the full-screen map).
export function setDockPinned(value: boolean) {
  pinned = value;
  if (dock) update();
}

// Moves focus to the dock's first button (MapSkipLink); false when it holds none.
export function focusDock() {
  const first = document.getElementById("floating-dock")?.querySelector<HTMLElement>("button, a[href]");
  first?.focus();
  return Boolean(first);
}
