"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { SelectField } from "@/components/ui/select-field";
import { groupCategories } from "./listing-fields";
import type { ListingOptions } from "./use-partner-listings";

// The first step of adding a listing (RAA-50): what it is, as a category and a subcategory.
// Next opens the rest of the steps for that category.
export function ListingCategoryPicker({ options, initialId }: { options: ListingOptions; initialId?: number }) {
  const router = useRouter();
  const groups = groupCategories(options.categories);
  const initial = options.categories.find((category) => category.id === initialId);
  const [groupName, setGroupName] = useState(initial ? (initial.parent_name ?? initial.name) : "");
  const [categoryId, setCategoryId] = useState(initial ? String(initial.id) : "");
  const group = groups.find((option) => option.name === groupName);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (categoryId) router.push(`/partner/listings/new/details?category=${categoryId}`);
  }

  return (
    <form data-testid="listing-category-picker" onSubmit={onSubmit} className="flex w-full flex-col gap-6">
      <p className="text-sm text-muted">Choose what you&apos;re listing. The next steps ask for what that kind needs.</p>
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
        <SelectField
          label="Subcategory"
          name="category_id"
          required
          disabled={!group}
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
          options={[
            { value: "", label: group ? "Choose a subcategory" : "Choose a category first" },
            ...(group?.categories ?? []).map((option) => ({ value: String(option.id), label: option.name })),
          ]}
        />
      </div>
      <div className="flex gap-3">
        <Button type="submit" disabled={!categoryId} data-testid="listing-category-next">
          Next
        </Button>
        <ButtonLink href="/partner/listings" variant="soft">
          Cancel
        </ButtonLink>
      </div>
    </form>
  );
}
