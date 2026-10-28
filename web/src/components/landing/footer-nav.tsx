"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { MouseEvent } from "react";

const LINKS = [
  { href: "/#destinations", label: "Destinations" },
  { href: "/#activities", label: "Activities" },
  { href: "/about", label: "About us" },
  { href: "/partner/register", label: "List with us" },
];

// On the home page a section link scrolls there itself, every time: Next leaves a hash already
// in the URL alone, so a second click after scrolling away did nothing. Once the scroll settles,
// the section's heading lands (animate-land) so the eye finds it.
function goToSection(event: MouseEvent<HTMLAnchorElement>, id: string) {
  const section = document.getElementById(id);
  if (!section) return;
  event.preventDefault();
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  history.replaceState(null, "", `#${id}`);

  const header = section.querySelector<HTMLElement>(":scope > header");
  let landed = false;
  const land = () => {
    if (landed || !header) return;
    landed = true;
    header.classList.remove("animate-land");
    void header.offsetWidth; // restart the animation on a repeat click
    header.classList.add("animate-land");
  };
  // scrollend is the cue; the timeout covers browsers without it and a scroll that never starts.
  window.addEventListener("scrollend", land, { once: true });
  window.setTimeout(land, reduce ? 0 : 900);
  section.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
}

export function FooterNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Footer" className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
      {LINKS.map((link) => {
        const id = link.href.startsWith("/#") ? link.href.slice(2) : null;
        return (
          <Link
            key={link.href}
            href={link.href}
            onClick={id && pathname === "/" ? (event) => goToSection(event, id) : undefined}
            className="flex min-h-11 items-center justify-center rounded-button border border-glass-edge bg-glass-fill px-4 font-medium whitespace-nowrap transition-[background-color,transform] duration-300 ease-calm hover:bg-glass-hover motion-safe:active:scale-[0.96]"
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
