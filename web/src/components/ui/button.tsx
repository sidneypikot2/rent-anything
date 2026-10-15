import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "./cn";

const VARIANTS = {
  primary: "bg-primary text-white hover:bg-primary-hover",
  secondary: "bg-secondary text-white hover:bg-secondary-hover",
  // The outline button, a quiet action: white fill, blue text.
  soft: "border border-line-strong bg-surface text-primary hover:border-primary hover:bg-mist",
  // A soft call to action on a dark band: pale blue under navy text.
  accent: "bg-aqua font-bold text-navy hover:bg-fern",
  // Something that can't be undone, like deleting. White on danger is 6.5:1.
  danger: "bg-danger text-white hover:bg-danger-hover",
  // Text only, for a secondary way out (a wizard's Cancel) that shouldn't draw the eye.
  ghost: "text-muted underline-offset-4 hover:text-foreground hover:underline",
};

const SIZES = {
  sm: "rounded-control px-4 py-2 text-sm",
  // The small look with a 44px touch target, for an action a traveller taps on a phone (RAA-85).
  touch: "min-h-11 rounded-control px-4 py-2 text-sm",
  md: "min-h-12 rounded-control px-6 py-3 text-[0.9375rem]",
};

export type ButtonStyle = {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
};

function buttonClasses({ variant = "primary", size = "md" }: ButtonStyle) {
  return cn(
    "inline-flex items-center justify-center gap-2 font-semibold",
    "transition-[background-color,border-color,box-shadow,transform] duration-300 ease-calm hover:-translate-y-px hover:shadow-soft active:translate-y-0",
    "disabled:pointer-events-none disabled:opacity-50",
    VARIANTS[variant],
    SIZES[size],
  );
}

export function Button({ variant, size, className, ...props }: ButtonStyle & ComponentProps<"button">) {
  return <button className={cn(buttonClasses({ variant, size }), className)} {...props} />;
}

// A link that looks like a Button.
export function ButtonLink({
  variant,
  size,
  className,
  ...props
}: ButtonStyle & ComponentProps<typeof Link>) {
  return <Link className={cn(buttonClasses({ variant, size }), className)} {...props} />;
}
