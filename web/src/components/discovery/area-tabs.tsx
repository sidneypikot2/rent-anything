"use client";

import { useEffect, useState } from "react";
import { cn } from "@/components/ui/cn";
import { glassClasses } from "@/components/ui/glass";

// The area page's sections as tabs under its banner (RAA-125): a light glass bar that sticks
// 12px under the header as the page scrolls, marking the section in view. It sits one block
// below the banner and one block above the first section, so it is spaced evenly between them.
export function AreaTabs({ sections }: { sections: { id: string; label: string }[] }) {
  const [current, setCurrent] = useState(sections[0]?.id);

  useEffect(() => {
    const update = () => {
      let inView = sections[0]?.id;
      for (const { id } of sections) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= 170) inView = id;
      }
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
        inView = sections[sections.length - 1]?.id;
      }
      setCurrent(inView);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, [sections]);

  if (sections.length < 2) return null;

  return (
    <nav
      aria-label="On this page"
      className="sticky top-20 z-30 mt-[max(0px,calc(var(--spacing-block)-0.75rem))] flex justify-center px-3 sm:mt-[max(0px,calc(var(--spacing-block)-1.5rem))] sm:px-6"
    >
      <ul className={cn(glassClasses("light"), "flex max-w-full gap-0.5 overflow-x-auto rounded-full p-1 shadow-soft [scrollbar-width:none]")}>
        {sections.map(({ id, label }) => (
          <li key={id}>
            <a
              href={`#${id}`}
              aria-current={current === id ? "true" : undefined}
              onClick={(event) => {
                // Clear the header and this bar, which a section's own scroll margin doesn't.
                const el = document.getElementById(id);
                if (!el) return;
                event.preventDefault();
                const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
                window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 150, behavior: reduce ? "auto" : "smooth" });
                history.replaceState(null, "", `#${id}`);
                setCurrent(id);
              }}
              className={cn(
                "flex min-h-11 items-center rounded-full px-4 text-sm font-bold whitespace-nowrap transition-colors duration-300 ease-calm",
                current === id ? "bg-navy text-white" : "hover:bg-navy/6",
              )}
            >
              {label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
