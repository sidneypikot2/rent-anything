import Link from "next/link";
import type { ComponentProps } from "react";
import { ArrowGlyph, CheckGlyph, PlusGlyph } from "@/components/discovery/tag-glyphs";
import { cn } from "./cn";

// The main action in the action colour, a hairline outline for the quiet ones, no lift; on guest
// pages they are pills with soft shadows (globals.css). An icon after the label says what the
// button does: plus adds to a trip, check marks it in the trip, arrow moves you on.
const HAIRLINE = "inset-ring-1 inset-ring-line-strong shadow-xs";

const VARIANTS = {
  primary: "bg-action text-on-action shadow-xs inset-shadow-xs inset-shadow-white/15 hover:bg-action-hover",
  secondary: "bg-secondary text-white hover:bg-secondary-hover",
  // The outline button, a quiet action: white fill, a hairline outline, text in the action
  // colour (guest pages outline it in lagoon ink, globals.css).
  soft: cn(HAIRLINE, "bg-surface text-primary hover:bg-mist hover:inset-ring-primary"),
  // A soft call to action on a dark band: mint under ink.
  accent: "bg-mint text-navy hover:bg-sage",
  // A card's action (Add to trip): ink on the action tint, with a solid 1px edge so it reads as a button.
  tint: "bg-action-tint text-action-ink inset-ring-1 inset-ring-action-edge hover:bg-surface",
  // The main action on a photo: white.
  paper: "bg-white text-navy shadow-xs hover:bg-sky-mist",
  // Something that can't be undone, like deleting. White on danger is 6.5:1.
  danger: "bg-danger text-white hover:bg-danger-hover",
  // Text only, for a secondary way out (a wizard's Cancel) that shouldn't draw the eye.
  ghost: "text-muted underline-offset-4 hover:text-foreground hover:underline",
  // A control that is only an icon, like closing a panel.
  quiet: "text-navy hover:bg-surface-2",
  // A quiet action on dark glass (the edit page's save bar): light text, a faint fill on hover.
  glass: "text-white/80 hover:bg-white/10 hover:text-white",
  // A way on from a panel on a photo: a clear button with a white hairline.
  frosted: "inset-ring-1 inset-ring-white/50 text-white hover:bg-glass-fill",
  // The main action on dark glass (partner pages; out of this preview's scope).
  glow: "bg-linear-to-b from-primary to-secondary text-white inset-shadow-xs inset-shadow-white/30 shadow-[0_8px_24px_-8px_var(--color-primary)] hover:from-primary-hover hover:to-secondary-hover",
};

const SIZES = {
  // Compact to look at, still a 44px tap target.
  sm: "min-h-11 rounded-button px-4 py-2 text-sm",
  touch: "min-h-11 rounded-button px-4 py-2 text-sm",
  md: "min-h-12 rounded-button px-6 py-3 text-control",
  // A square 44px button holding one icon; give it an aria-label.
  icon: "size-11 rounded-button",
  "icon-lg": "size-12 rounded-button sm:size-14",
  pill: "min-h-11 rounded-button px-5 py-2.5 text-control",
};

type Glyph = "arrow" | "plus" | "check";

export type ButtonStyle = {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  // A button that takes you somewhere (Search, See N options): an arrow after the label.
  arrow?: boolean;
  // An icon after the label: plus to add to a trip, check once it holds it.
  glyph?: Glyph;
};

function glyphOf({ arrow, glyph }: ButtonStyle): Glyph | undefined {
  return glyph ?? (arrow ? "arrow" : undefined);
}

function buttonClasses({ variant = "primary", size = "md" }: ButtonStyle) {
  return cn(
    // btn / btn-<variant> carry the guest pages' shadows and pressed and disabled states (globals.css).
    "btn group/button relative inline-flex items-center justify-center gap-2 font-semibold",
    `btn-${variant}`,
    "transition-[background-color,box-shadow,color] duration-150 ease-calm motion-safe:active:translate-y-px",
    "disabled:pointer-events-none disabled:opacity-50",
    VARIANTS[variant],
    SIZES[size],
  );
}

// The icon takes the action colour's glyph tone on a main button, the button's ink elsewhere.
const GLYPH_TONE: Partial<Record<keyof typeof VARIANTS, string>> = {
  primary: "text-action-glyph",
  soft: "text-primary",
  tint: "text-action-ink",
};

function TrailingGlyph({ glyph, variant = "primary" }: { glyph: Glyph; variant?: keyof typeof VARIANTS }) {
  const cls = cn("size-4 shrink-0", GLYPH_TONE[variant] ?? "opacity-80");
  if (glyph === "plus") return <PlusGlyph className={cls} />;
  if (glyph === "check") return <CheckGlyph className={cls} />;
  return (
    <ArrowGlyph
      className={cn(cls, "transition-transform duration-150 ease-calm motion-safe:group-hover/button:translate-x-0.5")}
    />
  );
}

// A ring turning in the label's colour while a button works (its own text says what, "Adding…").
// With reduced motion it stands still, a broken ring.
function Spinner() {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className="size-4 shrink-0 motion-safe:animate-spin">
      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeOpacity="0.3" strokeWidth="2" />
      <path d="M8 2a6 6 0 0 1 6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// `loading` keeps the button in its own colour with a spinner (not the muted disabled look),
// and stops a second press.
export function Button({
  variant,
  size,
  arrow,
  glyph: g,
  loading = false,
  disabled,
  className,
  children,
  ...props
}: ButtonStyle & { loading?: boolean } & ComponentProps<"button">) {
  const glyph = glyphOf({ arrow, glyph: g });
  return (
    <button
      className={cn(buttonClasses({ variant, size }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Spinner />}
      {children}
      {glyph && !loading && <TrailingGlyph glyph={glyph} variant={variant} />}
    </button>
  );
}

// A link that looks like a Button.
export function ButtonLink({
  variant,
  size,
  arrow,
  glyph: g,
  className,
  children,
  ...props
}: ButtonStyle & ComponentProps<typeof Link>) {
  const glyph = glyphOf({ arrow, glyph: g });
  return (
    <Link className={cn(buttonClasses({ variant, size }), className)} {...props}>
      {children}
      {glyph && <TrailingGlyph glyph={glyph} variant={variant} />}
    </Link>
  );
}
