import type { ComponentProps } from "react";
import { cn } from "./cn";

const TONES = {
  // Controls on a photo: the nav pill, the search bar, a category tile. White text.
  dark: "border-glass-edge bg-navy/40 text-white backdrop-blur-lg",
  // Forest-tinted, for a trust or trip element on a photo, and the footer. White text.
  forest: "border-glass-edge bg-forest/50 text-white backdrop-blur-lg",
  // A badge or tab bar on a photo. Dark text.
  light: "border-white/60 bg-white/70 text-foreground backdrop-blur-md",
  // The faint frame inset into a full-bleed hero, holding the other panels.
  frame: "border-glass-edge bg-white/5 text-white inset-shadow-xs inset-shadow-white/25 backdrop-blur-[2px]",
  // A guest page's content over the fixed backdrop (RAA-107): the same glass as the hero frame. It
  // carries on-glass (globals.css): the text inside turns light, white cards keep theirs dark.
  sheet: "on-glass border-glass-edge bg-white/5 inset-shadow-xs inset-shadow-white/25 backdrop-blur-[2px]",
};

export type GlassTone = keyof typeof TONES;

// The glass look for an element that can't be a GlassPanel, like a link.
export function glassClasses(tone: GlassTone = "dark") {
  return cn("border transition-colors duration-500 ease-calm", TONES[tone]);
}

// Frosted glass for things that sit on a photo (Sky & Forest, RAA-102). Only over a photo
// with a scrim behind the text; on white, use a Card. Round it with a className.
export function GlassPanel({ tone, className, ...props }: { tone?: GlassTone } & ComponentProps<"div">) {
  return <div className={cn(glassClasses(tone), className)} {...props} />;
}
