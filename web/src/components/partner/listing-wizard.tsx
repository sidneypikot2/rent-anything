"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { PhAddressFields, usePhAddress } from "@/components/address/ph-address-fields";
import { Button, ButtonLink } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { Field } from "@/components/ui/field";
import { TextareaField } from "@/components/ui/textarea-field";
import type { LatLng } from "@/lib/map";
import {
  AttributeFields,
  attributeFields,
  categoryLabel,
  geocodeQuery,
  NO_ADDRESS,
  toAttrs,
  type AttributeValues,
} from "./listing-fields";
import { LocationPicker } from "./location-picker";
import { useCreateListing, type ListingCategory } from "./use-partner-listings";

type StepKey = "basic" | "location" | "details" | "rate";

// Adding a listing of the chosen category (RAA-50), one step at a time: Basic, Location,
// the category's own details (skipped when it has none) and Rate. Only the current step is
// on the page, so the browser's required checks cover just that step; every value is kept
// here, so going back loses nothing. The listing is saved as a draft.
export function ListingWizard({ category }: { category: ListingCategory }) {
  const router = useRouter();
  const create = useCreateListing();
  const fields = attributeFields(category);
  const steps: { key: StepKey; label: string }[] = [
    { key: "basic", label: "Basic" },
    { key: "location", label: "Location" },
    ...(fields.length > 0 ? [{ key: "details" as const, label: `${category.name} details` }] : []),
    { key: "rate", label: "Rate" },
  ];
  const [stepIndex, setStepIndex] = useState(0);
  const step = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const address = usePhAddress(NO_ADDRESS);
  const [location, setLocation] = useState<LatLng | null>(null);
  const [locationError, setLocationError] = useState<string>();
  const [attrValues, setAttrValues] = useState<AttributeValues>({});
  // Shown and checked, not saved yet: the API has no pricing until its own ticket.
  const [dailyRate, setDailyRate] = useState("");

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step.key === "location" && !location) {
      setLocationError("Drop a pin on the map");
      return;
    }
    if (!isLast) {
      setStepIndex(stepIndex + 1);
      return;
    }
    if (!location) return;
    create.mutate(
      {
        title: title.trim(),
        description: description.trim(),
        category_id: category.id,
        address: address.toBody(),
        location,
        attrs: toAttrs(fields, attrValues),
      },
      { onSuccess: () => router.push("/partner/listings") },
    );
  }

  return (
    <form data-testid="listing-wizard" onSubmit={onSubmit} className="flex w-full flex-col gap-6">
      <ol aria-label="Steps" className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
        {steps.map((option, index) => (
          <li
            key={option.key}
            aria-current={index === stepIndex ? "step" : undefined}
            className={cn("flex items-center gap-2", index === stepIndex ? "font-semibold text-foreground" : "text-muted")}
          >
            <span
              className={cn(
                "flex size-6 items-center justify-center rounded-full border-[1.5px] text-xs",
                index <= stepIndex ? "border-primary bg-primary text-white" : "border-line-strong",
              )}
            >
              {index + 1}
            </span>
            {option.label}
          </li>
        ))}
      </ol>

      {create.error && (
        <p role="alert" className="text-sm text-danger">
          {create.error.message}
        </p>
      )}

      <fieldset data-testid={`listing-step-${step.key}`} className="flex flex-col gap-4">
        <legend className="mb-2 font-display text-2xl font-bold italic">{step.label}</legend>

        {step.key === "basic" && (
          <>
            <p className="text-sm text-muted">
              Listing a <span className="font-medium text-foreground">{categoryLabel(category)}</span>.{" "}
              <Link
                href={`/partner/listings/new?category=${category.id}`}
                className="text-link underline"
                data-testid="listing-change-category"
              >
                Change
              </Link>
            </p>
            <Field
              label="Title"
              name="title"
              required
              maxLength={120}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Sardine run and turtle snorkel"
            />
            <TextareaField
              label="Description"
              name="description"
              maxLength={5000}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              hint="What's included, what to bring, anything a traveller should know."
            />
          </>
        )}

        {step.key === "location" && (
          <>
            <PhAddressFields address={address} />
            <LocationPicker
              value={location}
              onChange={(point) => {
                setLocation(point);
                setLocationError(undefined);
              }}
              geocodeQuery={geocodeQuery(address)}
              error={locationError}
            />
          </>
        )}

        {step.key === "details" && <AttributeFields fields={fields} values={attrValues} onChange={setAttrValues} />}

        {step.key === "rate" && (
          <Field
            label="Daily rate (₱)"
            name="daily_rate"
            type="number"
            min={0}
            step="any"
            value={dailyRate}
            onChange={(event) => setDailyRate(event.target.value)}
            hint="Rates aren't saved yet — you'll set them on the listing once pricing is available."
          />
        )}
      </fieldset>

      <div className="flex gap-3">
        {stepIndex > 0 && (
          <Button type="button" variant="soft" onClick={() => setStepIndex(stepIndex - 1)} data-testid="listing-back">
            Back
          </Button>
        )}
        {isLast ? (
          <Button type="submit" disabled={create.isPending} data-testid="listing-save">
            {create.isPending ? "Saving…" : "Save as draft"}
          </Button>
        ) : (
          <Button type="submit" data-testid="listing-next">
            Next
          </Button>
        )}
        <ButtonLink href="/partner/listings" variant="soft">
          Cancel
        </ButtonLink>
      </div>
    </form>
  );
}
