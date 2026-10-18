import Link from "next/link";
import type { ComponentProps } from "react";
import { ArrowGlyph } from "@/components/discovery/tag-glyphs";
import { cn } from "./cn";

// Filled buttons are lit from above: a 1px light top edge and a soft shadow in their own colour
// (RAA-125), so they read as raised and press in when clicked.
const LIT = "inset-shadow-xs inset-shadow-white/30";

const VARIANTS = {
  primary: cn(LIT, "bg-primary text-white shadow-[0_10px_22px_-12px_var(--color-primary)] hover:bg-primary-hover"),
  secondary: cn(LIT, "bg-secondary text-white shadow-[0_10px_22px_-12px_var(--color-secondary)] hover:bg-secondary-hover"),
  // The outline button, a quiet action: white fill, blue text.
  soft: "border border-line-strong bg-surface text-primary hover:border-primary hover:bg-mist",
  // A soft call to action on a dark band: pale blue under navy text.
  accent: "bg-aqua font-bold text-navy hover:bg-fern",
  // A quiet action on white that turns blue when pointed at, like Add to trip (RAA-125).
  tint: "bg-aqua text-navy inset-ring inset-ring-navy/5 hover:bg-primary hover:text-white",
  // Something that can't be undone, like deleting. White on danger is 6.5:1.
  danger: cn(LIT, "bg-danger text-white hover:bg-danger-hover"),
  // Text only, for a secondary way out (a wizard's Cancel) that shouldn't draw the eye.
  ghost: "text-muted underline-offset-4 hover:text-foreground hover:underline",
  // A control that is only an icon, like closing a panel: muted until hovered.
  quiet: "text-muted hover:bg-surface-2 hover:text-foreground",
  // A quiet action on dark glass (the edit page's save bar): light text, a faint fill on hover.
  glass: "text-white/80 hover:bg-white/10 hover:text-white",
  // The main action on dark glass: blue with a lit top edge, so it reads as raised.
  glow: "bg-linear-to-b from-primary to-secondary text-white inset-shadow-xs inset-shadow-white/30 shadow-[0_8px_24px_-8px_var(--color-primary)] hover:from-primary-hover hover:to-secondary-hover",
};

// Every text button is a pill (RAA-125).
const SIZES = {
  sm: "rounded-full px-4 py-2 text-sm",
  // The small look with a 44px touch target, for an action a traveller taps on a phone (RAA-85).
  touch: "min-h-11 rounded-full px-4 py-2 text-sm",
  md: "min-h-12 rounded-full px-6 py-3 text-control",
  // A round 44px button holding one icon; give it an aria-label.
  icon: "size-11 rounded-full",
  // The same, larger, for the one main action in a tall bar (the home page's search):
  // 48px, 56px from sm.
  "icon-lg": "size-12 rounded-full sm:size-14",
  // The md height as a pill.
  pill: "min-h-11 rounded-full px-5 py-2.5 text-control",
};

export type ButtonStyle = {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  // A trailing arrow in its own round well, which nudges forward on hover: for a button that
  // takes you somewhere (Show me, Start your trip).
  arrow?: boolean;
};

function buttonClasses({ variant = "primary", size = "md", arrow = false }: ButtonStyle) {
  return cn(
    "group/button relative inline-flex items-center justify-center gap-2 font-semibold",
    "transition-[background-color,border-color,box-shadow,transform,color] duration-300 ease-calm motion-safe:hover:-translate-y-px active:translate-y-0 active:scale-[0.98]",
    // While lifted, a 1px strip fills the row it left, so a pointer on its bottom edge stays on
    // it: otherwise the lift moves it off the pointer, it drops back, and it jitters forever
    // (and Playwright's click waits on it settling).
    "hover:after:absolute hover:after:inset-x-0 hover:after:top-full hover:after:h-px",
    "disabled:pointer-events-none disabled:opacity-50",
    VARIANTS[variant],
    SIZES[size],
    arrow && "gap-3 pr-2",
  );
}

function Arrow() {
  return (
    <span
      aria-hidden
      className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/18 transition-transform duration-300 ease-calm motion-safe:group-hover/button:translate-x-0.5"
    >
      <ArrowGlyph className="size-4" />
    </span>
  );
}

export function Button({ variant, size, arrow, className, children, ...props }: ButtonStyle & ComponentProps<"button">) {
  return (
    <button className={cn(buttonClasses({ variant, size, arrow }), className)} {...props}>
      {children}
      {arrow && <Arrow />}
    </button>
  );
}

// A link that looks like a Button.
export function ButtonLink({
  variant,
  size,
  arrow,
  className,
  children,
  ...props
}: ButtonStyle & ComponentProps<typeof Link>) {
  return (
    <Link className={cn(buttonClasses({ variant, size, arrow }), className)} {...props}>
      {children}
      {arrow && <Arrow />}
    </Link>
  );
}
