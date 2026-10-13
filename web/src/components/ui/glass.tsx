import type { ComponentProps } from "react";
import { cn } from "./cn";

const TONES = {
  // Controls on a photo: the nav pill, the search bar, a category tile. White text.
  dark: "border-white/20 bg-navy/40 text-white backdrop-blur-lg",
  // The forest variant, alternated with dark in a row of tiles. White text.
  forest: "border-white/20 bg-forest/50 text-white backdrop-blur-lg",
  // A badge or tab bar on a photo. Dark text.
  light: "border-white/60 bg-white/70 text-foreground backdrop-blur-md",
  // The faint frame inset into a full-bleed hero, holding the other panels.
  frame: "border-white/25 bg-white/5 text-white inset-shadow-xs inset-shadow-white/25 backdrop-blur-[2px]",
};

export type GlassTone = keyof typeof TONES;

// The glass look for an element that can't be a GlassPanel, like a link.
export function glassClasses(tone: GlassTone = "dark") {
  return cn("border", TONES[tone]);
}

// Frosted glass for things that sit on a photo (Sky & Forest, RAA-102). Only over a photo
// with a scrim behind the text; on white, use a Card. Round it with a className.
export function GlassPanel({ tone, className, ...props }: { tone?: GlassTone } & ComponentProps<"div">) {
  return <div className={cn(glassClasses(tone), className)} {...props} />;
}
