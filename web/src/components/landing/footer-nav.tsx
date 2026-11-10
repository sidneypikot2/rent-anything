"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { MouseEvent } from "react";
import { LEGAL_LINKS } from "@/components/legal/legal-page";
import { SUPPORT_EMAIL } from "@/lib/brand";

type FooterLink = { href: string; label: string };

// The footer's ways around, a column per kind of visitor. Partner terms sit with the partners,
// so Legal takes the rest of LEGAL_LINKS.
const COLUMNS: { title: string; links: FooterLink[] }[] = [
  {
    title: "Explore",
    links: [
      { href: "/plan", label: "Plan a trip" },
      { href: "/#book-one", label: "Book one thing" },
      { href: "/#get-to-know", label: "Places to visit" },
      { href: "/search", label: "Search" },
    ],
  },
  {
    title: "Partners",
    links: [
      { href: "/partner/register", label: "List with us" },
      { href: "/partner/login", label: "Partner sign in" },
      { href: "/partner-terms", label: "Partner terms" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About us" },
      { href: `mailto:${SUPPORT_EMAIL}`, label: "Contact us" },
    ],
  },
  { title: "Legal", links: LEGAL_LINKS.filter((link) => link.href !== "/partner-terms") },
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

  const heading = section.querySelector<HTMLElement>(":scope > header, :scope > h2");
  let landed = false;
  const land = () => {
    if (landed || !heading) return;
    landed = true;
    heading.classList.remove("animate-land");
    void heading.offsetWidth; // restart the animation on a repeat click
    heading.classList.add("animate-land");
  };
  // scrollend is the cue; the timeout covers browsers without it and a scroll that never starts.
  window.addEventListener("scrollend", land, { once: true });
  window.setTimeout(land, reduce ? 0 : 900);
  section.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
}

const LINK_CLASS = "flex min-h-11 items-center text-sky-mist underline-offset-4 hover:text-white hover:underline sm:min-h-9";

export function FooterNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Footer" className="grid grid-cols-2 gap-x-gutter gap-y-4 md:grid-cols-4">
      {COLUMNS.map((column) => (
        <div key={column.title} className="flex flex-col gap-1">
          <h2 className="font-display text-sm font-semibold text-white">{column.title}</h2>
          <ul className="flex flex-col">
            {column.links.map((link) => {
              const id = link.href.startsWith("/#") ? link.href.slice(2) : null;
              return (
                <li key={link.href}>
                  {link.href.startsWith("mailto:") ? (
                    <a href={link.href} className={LINK_CLASS}>
                      {link.label}
                    </a>
                  ) : (
                    <Link
                      href={link.href}
                      onClick={id && pathname === "/" ? (event) => goToSection(event, id) : undefined}
                      className={LINK_CLASS}
                    >
                      {link.label}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
