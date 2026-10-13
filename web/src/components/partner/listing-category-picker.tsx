"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { SelectField } from "@/components/ui/select-field";
import { ChoiceCards } from "@/components/ui/choice-cards";
import { groupCategories, type CategoryGroup } from "./listing-fields";
import { isStay } from "./stay-fields";
import type { PartnerBusiness } from "./use-partner-businesses";
import type { ListingOptions } from "./use-partner-listings";

// What a group's subcategory cards are headed with.
function subcategoryLegend(group: CategoryGroup) {
  if (group.categories.every(isStay)) return "Property type";
  if (group.name === "Vehicle rental") return "Type of vehicle";
  if (group.name === "Equipment rental") return "Type of equipment";
  return "Type";
}

function listingsCount(business: PartnerBusiness) {
  const count = business.listings_count;
  return count === 0 ? "No listings yet" : `${count} ${count === 1 ? "listing" : "listings"}`;
}

// The first step of adding a listing (RAA-50): which of the partner's businesses it is for
// (RAA-101; the only one is preselected), then what it is, as a category and then a
// subcategory, the subcategory as cards each saying what it means (RAA-83, RAA-89).
// Next opens the rest of the steps for that business and category.
export function ListingCategoryPicker({
  options,
  businesses,
  initialId,
  initialBusinessId,
}: {
  options: ListingOptions;
  businesses: PartnerBusiness[];
  initialId?: number;
  initialBusinessId?: number;
}) {
  const router = useRouter();
  const initialBusiness =
    businesses.find((business) => business.id === initialBusinessId) ??
    (businesses.length === 1 ? businesses[0] : undefined);
  const [businessId, setBusinessId] = useState(initialBusiness ? String(initialBusiness.id) : "");
  const groups = groupCategories(options.categories);
  const initial = options.categories.find((category) => category.id === initialId);
  const [groupName, setGroupName] = useState(initial ? (initial.parent_name ?? initial.name) : "");
  const [categoryId, setCategoryId] = useState(initial ? String(initial.id) : "");
  const group = groups.find((option) => option.name === groupName);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (businessId && categoryId) {
      router.push(`/partner/listings/new/details?business=${businessId}&category=${categoryId}`);
    }
  }

  return (
    <form data-testid="listing-category-picker" onSubmit={onSubmit} className="flex w-full flex-col gap-6">
      <p className="text-sm text-muted">Choose what you&apos;re listing. The next steps ask for what that kind needs.</p>
      <div className="flex flex-col gap-2">
        <ChoiceCards
          legend="Which business is this for?"
          name="business_id"
          required
          columns={2}
          value={businessId}
          onChange={setBusinessId}
          choices={businesses.map((business) => ({
            value: String(business.id),
            label: business.name,
            description: listingsCount(business),
          }))}
          data-testid="listing-business-cards"
        />
        <Link
          href="/partner/businesses/new?next=/partner/listings/new"
          className="self-start text-sm text-link underline"
          data-testid="listing-add-business"
        >
          Add business
        </Link>
      </div>
      <div className="flex flex-col gap-4">
        <SelectField
          label="Category"
          name="category_group"
          required
          value={groupName}
          onChange={(event) => {
            setGroupName(event.target.value);
            setCategoryId("");
          }}
          options={[
            { value: "", label: "Choose a category" },
            ...groups.map((option) => ({ value: option.name, label: option.name })),
          ]}
        />
        {group && (
          <ChoiceCards
            legend={subcategoryLegend(group)}
            name="category_id"
            required
            value={categoryId}
            onChange={setCategoryId}
            choices={group.categories.map((option) => ({
              value: String(option.id),
              label: option.name,
              description: option.description,
            }))}
            data-testid="listing-subcategory-cards"
          />
        )}
      </div>
      <div className="flex gap-3">
        <Button type="submit" disabled={!businessId || !categoryId} data-testid="listing-category-next">
          Next
        </Button>
        <ButtonLink href="/partner/listings" variant="soft">
          Cancel
        </ButtonLink>
      </div>
    </form>
  );
}
