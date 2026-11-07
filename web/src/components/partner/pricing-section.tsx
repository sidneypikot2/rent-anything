"use client";

import type { ReactNode } from "react";
import { CheckboxField } from "@/components/ui/checkbox-field";

// One part of the pricing, divided from the one above: a title and a line on what it's for.
// Without a title it's only the divider (the extra fees, which head themselves).
export function PricingSection({
  title,
  intro,
  children,
  ...props
}: {
  title?: string;
  intro?: string;
  children: ReactNode;
  "data-testid"?: string;
}) {
  return (
    <div className="border-t border-line py-6 last:pb-0">
      <fieldset className="flex flex-col" {...props}>
        {title && (
          <legend className="mb-4 flex flex-col gap-1">
            <span className="text-base font-semibold">{title}</span>
            {intro && <span className="text-sm text-muted">{intro}</span>}
          </legend>
        )}
        <div className="flex flex-col gap-4">{children}</div>
      </fieldset>
    </div>
  );
}

// An optional rate: a tick box that says what it is, and once ticked its fields under it.
export function OptionalRate({
  label,
  name,
  on,
  onToggle,
  children,
}: {
  label: string;
  name: string;
  on: boolean;
  onToggle: (on: boolean) => void;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <CheckboxField
        label={label}
        name={`${name}_on`}
        checked={on}
        onChange={(event) => onToggle(event.target.checked)}
        data-testid={`pricing-${name}-on`}
      />
      {on && <div className="grid gap-4 pl-6 sm:grid-cols-2">{children}</div>}
    </div>
  );
}
