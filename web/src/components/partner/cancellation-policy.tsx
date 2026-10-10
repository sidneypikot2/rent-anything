"use client";

import { ChoiceCards } from "@/components/ui/choice-cards";
import type { ListingOptions } from "./use-partner-listings";

// What a guest gets back on cancelling (RAA-88), chosen for every listing. The policies and
// their wording come from the API (listing_options), so they read the same everywhere.

export type CancellationPolicies = ListingOptions["cancellation_policies"];
export type CancellationPolicy = CancellationPolicies[number]["value"];
export const DEFAULT_CANCELLATION_POLICY: CancellationPolicy = "free_cancellation";

export function cancellationPolicyName(policies: CancellationPolicies | undefined, value: string) {
  return policies?.find((policy) => policy.value === value)?.name ?? value;
}

export function CancellationPolicyChoice({
  policies,
  value,
  onChange,
}: {
  policies: CancellationPolicies;
  value: CancellationPolicy;
  onChange: (value: CancellationPolicy) => void;
}) {
  return (
    <ChoiceCards
      legend="What guests get back if they cancel"
      name="cancellation_policy"
      required
      value={value}
      onChange={(next) => onChange(next as CancellationPolicy)}
      choices={policies.map((policy) => ({ value: policy.value, label: policy.name, description: policy.description }))}
      data-testid="listing-cancellation-policy"
    />
  );
}
