"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { CompassGlyph, HomeGlyph, PersonGlyph } from "@/components/discovery/tag-glyphs";
import { cn } from "@/components/ui/cn";
import { LOGIN_PATHS } from "@/lib/auth/paths";
import { isAnonymous, useSession } from "@/lib/auth/session";
import { LAUNCH_AREA } from "./launch-area";

// The home page's tab bar on a phone (the team's F, 2026-11-06): Home, Explore (the launch
// area's page) and Profile (sign in while signed out, or a guest with no account yet). From sm the
// header and the page's Bantayan card do its work, so it hides. It rises once the hero
// (`data-home-hero`) has scrolled away (audit, 2026-11-08): over the hero it covered the true
// points under the buttons and repeated the hero's own Explore. Until then it is `inert`, so focus
// skips it. `data-tab-bar` gives the page room under its footer (globals.css).
export function HomeTabBar() {
  const session = useSession();
  const signedIn = session && !isAnonymous(session);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const hero = document.querySelector("[data-home-hero]");
    if (!hero) return;
    const observer = new IntersectionObserver(([entry]) => setShown(!entry.isIntersecting));
    observer.observe(hero);
    return () => observer.disconnect();
  }, []);

  return (
    <nav
      aria-label="Main"
      data-tab-bar
      inert={!shown}
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 grid grid-cols-3 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] text-muted transition-[translate,opacity] duration-300 ease-calm sm:hidden",
        !shown && "translate-y-full opacity-0",
      )}
    >
      <Tab href="/" icon={<HomeGlyph className="size-6.5" />} current>
        Home
      </Tab>
      <Tab href={`/${LAUNCH_AREA.slug}`} icon={<CompassGlyph className="size-6.5" />} testId="tab-explore">
        Explore
      </Tab>
      <Tab href={signedIn ? "/profile" : LOGIN_PATHS.guest} icon={<PersonGlyph className="size-6.5" />}>
        Profile
      </Tab>
    </nav>
  );
}

function Tab({
  href,
  icon,
  current = false,
  testId,
  children,
}: {
  href: string;
  icon: ReactNode;
  current?: boolean;
  testId?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      data-testid={testId}
      className={cn(
        "flex min-h-19 flex-col items-center justify-center gap-1 text-control transition-colors duration-300 ease-calm",
        current ? "font-semibold text-action-ink" : "hover:text-navy",
      )}
    >
      {icon}
      {children}
    </Link>
  );
}
