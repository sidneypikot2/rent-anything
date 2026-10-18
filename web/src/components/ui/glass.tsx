import type { ComponentProps } from "react";
import { cn } from "./cn";

// On a phone the dark and forest glass is a denser tint with no blur: over the fixed backdrop
// every blurred panel is redrawn on each scroll frame, and a page holds a score of them.
const TONES = {
  // Controls on a photo: the nav pill, the search bar, a category tile. White text.
  dark: "focus-light border-glass-edge bg-navy/40 text-white backdrop-blur-lg max-sm:bg-navy/65 max-sm:backdrop-blur-none",
  // The text panel on a photo card. Denser than dark, at the phone's density everywhere: a
  // card's photo can be any partner's, and over a near-white one sky-mist text still reads at
  // 5:1 (dark's 40% leaves it near 3:1).
  card: "focus-light border-glass-edge bg-navy/65 text-white backdrop-blur-lg max-sm:backdrop-blur-none",
  // Forest-tinted, for a trust or trip element on a photo, and the footer. White text. Dense
  // enough that sky-mist text (6.5:1) and a glass-filled pill on it (5.5:1) keep 4.5:1 over a
  // white photo; at 75% they fell to 4.1 and 3.7 (RAA-130).
  forest: "focus-light border-glass-edge bg-forest/90 text-white backdrop-blur-lg max-sm:backdrop-blur-none",
  // A badge or tab bar on a photo. Dark text.
  light: "border-white/60 bg-white/70 text-foreground backdrop-blur-md",
  // The faint frame inset into a full-bleed hero, holding the other panels. No blur of its
  // own: a backdrop-filter makes it the backdrop the glass inside it blurs, so theirs would
  // blur the frame's faint fill rather than the photo.
  frame: "focus-light glass-frame text-white",
  // A guest page's content over the fixed backdrop (RAA-107): the same glass as the hero frame. It
  // carries on-glass (globals.css): the text inside turns light, white cards keep theirs dark.
  // Unblurred, like the frame, so the glass inside it blurs the photo.
  sheet: "on-glass glass-frame",
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
