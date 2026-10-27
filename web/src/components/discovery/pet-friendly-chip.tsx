import { PillLink } from "@/components/ui/pill";
import { FeatureGlyph } from "./tag-glyphs";

type SearchParams = Record<string, string | string[] | undefined>;

// Whether a page's URL asks for pet-friendly stays only (`?pets=1`, RAA-186).
export function wantsPets(searchParams: SearchParams) {
  return searchParams.pets === "1";
}

// The guest's Pet-friendly filter on an area page and /search (RAA-186): a chip linking to the
// same page with `pets=1` added, or taken off again, keeping the rest of its query (the dates,
// guests, a search). The API then keeps, of the stays, those that take pets.
export function PetFriendlyChip({ path, searchParams, hash = "" }: { path: string; searchParams: SearchParams; hash?: string }) {
  const on = wantsPets(searchParams);
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (key !== "pets" && typeof value === "string") query.set(key, value);
  }
  if (!on) query.set("pets", "1");
  const search = query.toString();
  return (
    <PillLink on={on} href={`${path}${search ? `?${search}` : ""}${hash}`} scroll={false} data-testid="pet-friendly-filter">
      <FeatureGlyph name="pets" className="size-4" />
      Pet-friendly
    </PillLink>
  );
}
