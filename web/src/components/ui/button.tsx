import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "./cn";

const VARIANTS = {
  primary: "bg-primary text-white hover:bg-primary-hover",
  secondary: "bg-secondary text-white hover:bg-secondary-hover",
  // A quiet action on a card: tinted fill, cerulean text.
  soft: "border-[1.5px] border-line bg-surface-2 text-primary hover:border-primary",
  // The loudest call to action, for dark bands. Navy text: white on aqua is 1.8:1.
  accent: "bg-aqua font-bold text-navy hover:bg-fern",
  // Something that can't be undone, like deleting. White on danger is 6.5:1.
  danger: "bg-danger text-white hover:bg-danger-hover",
};

const SIZES = {
  sm: "rounded-lg px-4 py-2 text-sm",
  md: "rounded-xl px-6 py-3 text-sm",
};

type Style = {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
};

function buttonClasses({ variant = "primary", size = "md" }: Style) {
  return cn(
    "inline-flex items-center justify-center gap-2 font-semibold transition-colors",
    "disabled:pointer-events-none disabled:opacity-50",
    VARIANTS[variant],
    SIZES[size],
  );
}

export function Button({ variant, size, className, ...props }: Style & ComponentProps<"button">) {
  return <button className={cn(buttonClasses({ variant, size }), className)} {...props} />;
}

// A link that looks like a Button.
export function ButtonLink({
  variant,
  size,
  className,
  ...props
}: Style & ComponentProps<typeof Link>) {
  return <Link className={cn(buttonClasses({ variant, size }), className)} {...props} />;
}
