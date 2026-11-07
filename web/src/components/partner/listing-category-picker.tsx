"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ArrowGlyph } from "@/components/discovery/tag-glyphs";
import { ActionBar } from "@/components/ui/action-bar";
import { Button, ButtonLink } from "@/components/ui/button";
import { ChoiceCards } from "@/components/ui/choice-cards";
import { GROUPS, groupCategories, type CategoryGroup } from "./listing-fields";
import { isStay } from "./stay-fields";
import type { PartnerBusiness } from "./use-partner-businesses";
import type { ListingOptions } from "./use-partner-listings";

// What a group's subcategory cards are headed with.
function subcategoryLegend(group: CategoryGroup) {
  if (group.categories.every(isStay)) return "Property type";
  if (group.name === "Vehicle rental") return "Type of vehicle";
  if (group.name === "Equipment rental") return "Type of equipment";
  if (group.name === "Water activities") return "Type of activity";
  return "Type";
}

const GROUP_ORDER = Object.keys(GROUPS);

function orderedGroups(groups: CategoryGroup[]) {
  const rank = (group: CategoryGroup) => {
    const index = GROUP_ORDER.indexOf(group.name);
    return index === -1 ? GROUP_ORDER.length : index;
  };
  return [...groups].sort((a, b) => rank(a) - rank(b));
}

function listingsCount(business: PartnerBusiness) {
  const count = business.listings_count;
  return count === 0 ? "No listings yet" : `${count} ${count === 1 ? "listing" : "listings"}`;
}

function detailsHref(businessId: string, categoryId: string | number) {
  return `/partner/listings/new/details?business=${businessId}&category=${categoryId}`;
}

// The first step of adding a listing (RAA-50): which of the partner's businesses it is for
// (RAA-101; the only one is preselected), then what it is, as cards each saying what it means
// (RAA-83, RAA-89). Next opens the group's kinds on their own page (RAA-268), or, for a group
// with one kind (tours, transfers), the rest of the steps for that business and category.
export function ListingCategoryPicker({
  options,
  businesses,
  initialId,
  initialBusinessId,
  initialGroup,
}: {
  options: ListingOptions;
  businesses: PartnerBusiness[];
  initialId?: number;
  initialBusinessId?: number;
  initialGroup?: string;
}) {
  const router = useRouter();
  const initialBusiness =
    businesses.find((business) => business.id === initialBusinessId) ??
    (businesses.length === 1 ? businesses[0] : undefined);
  const [businessId, setBusinessId] = useState(initialBusiness ? String(initialBusiness.id) : "");
  const groups = orderedGroups(groupCategories(options.categories));
  const initial = options.categories.find((category) => category.id === initialId);
  const [groupName, setGroupName] = useState(initial ? (initial.parent_name ?? initial.name) : (initialGroup ?? ""));
  const group = groups.find((option) => option.name === groupName);
  // Why Next is still disabled, said beside it.
  const missing = !businessId
    ? "Pick a business to continue"
    : !group
      ? "Pick what you're listing to continue"
      : undefined;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!businessId || !group) return;
    if (group.categories.length === 1) {
      router.push(detailsHref(businessId, group.categories[0].id));
      return;
    }
    const kept = initial && group.categories.includes(initial) ? `&category=${initial.id}` : "";
    router.push(`/partner/listings/new/type?business=${businessId}&group=${encodeURIComponent(group.name)}${kept}`);
  }

  return (
    <form data-testid="listing-category-picker" onSubmit={onSubmit} className="flex w-full flex-col gap-6">
      <p className="text-sm text-muted">The next steps ask only for what that kind of listing needs.</p>
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
      <ChoiceCards
        legend="What are you listing?"
        name="category_group"
        required
        value={groupName}
        onChange={setGroupName}
        choices={groups.map((option) => ({
          value: option.name,
          label: GROUPS[option.name]?.label ?? option.name,
          description: GROUPS[option.name]?.description,
        }))}
        data-testid="listing-group-cards"
      />
      <PickerFoot missing={missing} cancelHref="/partner/listings" cancelLabel="Cancel" testId="listing-category-next" />
    </form>
  );
}

// The second step (RAA-268): the kinds in the group picked on the first, on a page of their own.
// A group that doesn't exist, from an old link, goes back to the first step.
export function ListingTypePicker({
  options,
  businessId,
  groupName,
  initialId,
}: {
  options: ListingOptions;
  businessId?: number;
  groupName?: string;
  initialId?: number;
}) {
  const router = useRouter();
  const group = groupCategories(options.categories).find((option) => option.name === groupName);
  const [categoryId, setCategoryId] = useState(
    group?.categories.some((category) => category.id === initialId) ? String(initialId) : "",
  );

  if (!group || !businessId) {
    return (
      <Link href="/partner/listings/new" className="self-start text-sm text-link underline">
        Choose what you&apos;re listing
      </Link>
    );
  }

  const legend = subcategoryLegend(group);
  const back = `/partner/listings/new?business=${businessId}&${
    categoryId ? `category=${categoryId}` : `group=${encodeURIComponent(group.name)}`
  }`;

  return (
    <form
      data-testid="listing-type-picker"
      onSubmit={(event) => {
        event.preventDefault();
        if (categoryId) router.push(detailsHref(String(businessId), categoryId));
      }}
      className="flex w-full flex-col gap-6"
    >
      <ChoiceCards
        legend={legend}
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
      <PickerFoot
        missing={categoryId ? undefined : `Pick a ${legend.toLowerCase()} to continue`}
        cancelHref={back}
        cancelLabel="Back"
        testId="listing-type-next"
      />
    </form>
  );
}

function PickerFoot({
  missing,
  cancelHref,
  cancelLabel,
  testId,
}: {
  missing?: string;
  cancelHref: string;
  cancelLabel: string;
  testId: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      {missing && (
        <p id="listing-category-missing" className="text-sm text-muted">
          {missing}
        </p>
      )}
      <ActionBar>
        <ButtonLink href={cancelHref} variant="glass" size="pill">
          {cancelLabel}
        </ButtonLink>
        <Button
          type="submit"
          variant="glow"
          size="pill"
          disabled={missing !== undefined}
          aria-describedby={missing ? "listing-category-missing" : undefined}
          data-testid={testId}
        >
          Next
          <ArrowGlyph className="size-4" />
        </Button>
      </ActionBar>
    </div>
  );
}
