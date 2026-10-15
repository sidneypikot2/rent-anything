"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
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

// How each top-level category is offered, in the order partners on the island most often list:
// tours first. A group the API adds later still shows, under its own name, after these.
const GROUPS: Record<string, { label: string; description: string }> = {
  Services: { label: "Tours and services", description: "Island hopping, snorkelling trips, a photographer" },
  "Vehicle rental": { label: "Vehicle rental", description: "Motorbikes, trikes, cars and vans" },
  Accommodation: { label: "A place to stay", description: "Rooms, cottages, resorts and villas" },
  Transport: { label: "Transfers", description: "Port and airport pickups, van transfers" },
  "Equipment rental": { label: "Gear rental", description: "Cameras, snorkel sets and more" },
};
const GROUP_ORDER = Object.keys(GROUPS);

function orderedGroups(groups: CategoryGroup[]) {
  const rank = (group: CategoryGroup) => {
    const index = GROUP_ORDER.indexOf(group.name);
    return index === -1 ? GROUP_ORDER.length : index;
  };
  return [...groups]
    .sort((a, b) => rank(a) - rank(b))
    .map((group) => ({
      ...group,
      // A tour leads its group: it's what most partners here offer.
      categories: [...group.categories].sort((a, b) => Number(b.slug === "tour") - Number(a.slug === "tour")),
    }));
}

function listingsCount(business: PartnerBusiness) {
  const count = business.listings_count;
  return count === 0 ? "No listings yet" : `${count} ${count === 1 ? "listing" : "listings"}`;
}

// The first step of adding a listing (RAA-50): which of the partner's businesses it is for
// (RAA-101; the only one is preselected), then what it is, as a category and then a
// subcategory, both as cards each saying what it means (RAA-83, RAA-89). A group with one
// kind (transfers) picks it straight away.
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
  const groups = orderedGroups(groupCategories(options.categories));
  const initial = options.categories.find((category) => category.id === initialId);
  const [groupName, setGroupName] = useState(initial ? (initial.parent_name ?? initial.name) : "");
  const [categoryId, setCategoryId] = useState(initial ? String(initial.id) : "");
  const group = groups.find((option) => option.name === groupName);
  const subcategories = useRef<HTMLDivElement>(null);
  // Why Next is still disabled, said beside it.
  const missing = !businessId
    ? "Pick a business to continue"
    : !groupName
      ? "Pick what you're listing to continue"
      : !categoryId
        ? `Pick a ${group ? subcategoryLegend(group).toLowerCase() : "type"} to continue`
        : undefined;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (businessId && categoryId) {
      router.push(`/partner/listings/new/details?business=${businessId}&category=${categoryId}`);
    }
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
      <div className="flex flex-col gap-4">
        <ChoiceCards
          legend="What are you listing?"
          name="category_group"
          required
          value={groupName}
          onChange={(name) => {
            setGroupName(name);
            const only = groups.find((option) => option.name === name)?.categories;
            setCategoryId(only?.length === 1 ? String(only[0].id) : "");
            // The group's kinds open below the cards, often under the fold on a phone.
            if (only && only.length > 1) {
              const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
              requestAnimationFrame(() => subcategories.current?.scrollIntoView({ behavior: calm, block: "nearest" }));
            }
          }}
          choices={groups.map((option) => ({
            value: option.name,
            label: GROUPS[option.name]?.label ?? option.name,
            description: GROUPS[option.name]?.description,
          }))}
          data-testid="listing-group-cards"
        />
        {group && group.categories.length > 1 && (
          <div ref={subcategories} className="scroll-mb-28">
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
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          disabled={missing !== undefined}
          aria-describedby={missing ? "listing-category-missing" : undefined}
          data-testid="listing-category-next"
        >
          Next
        </Button>
        <ButtonLink href="/partner/listings" variant="soft">
          Cancel
        </ButtonLink>
        {missing && (
          <p id="listing-category-missing" className="text-sm text-muted">
            {missing}
          </p>
        )}
      </div>
    </form>
  );
}
