import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { PartnerListing } from "./use-partner-listings";

export const STATUS = {
  draft: { label: "Draft", tone: "mist" },
  pending: { label: "In review", tone: "aqua" },
  active: { label: "Live", tone: "emerald" },
} as const;

const UPDATED = new Intl.DateTimeFormat("en-PH", { day: "numeric", month: "short", year: "numeric" });

// The API orders listings by category, then title, so grouping keeps that order.
function byCategory(listings: PartnerListing[]) {
  const groups = new Map<number, { name: string; listings: PartnerListing[] }>();
  for (const listing of listings) {
    const group = groups.get(listing.category.id) ?? { name: listing.category.name, listings: [] };
    group.listings.push(listing);
    groups.set(listing.category.id, group);
  }
  return [...groups.entries()];
}

// Every listing the partner has, one section and table per category. A row opens the listing:
// its title is the link, stretched over the whole row.
export function ListingsByCategory({ listings }: { listings: PartnerListing[] }) {
  return (
    <div className="flex flex-col gap-8">
      {byCategory(listings).map(([id, group]) => (
        <section key={id} data-testid="listing-category" aria-labelledby={`category-${id}`} className="flex flex-col gap-3">
          <h2 id={`category-${id}`} className="flex items-baseline gap-2 font-display text-2xl font-bold italic">
            {group.name}
            <span className="font-sans text-sm font-normal not-italic text-muted">
              {group.listings.length} {group.listings.length === 1 ? "listing" : "listings"}
            </span>
          </h2>
          <Card className="overflow-x-auto">
            <table className="w-full min-w-lg text-left text-sm">
              <thead className="border-b border-line bg-surface-2 text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th scope="col" className="px-4 py-2 font-semibold">Title</th>
                  <th scope="col" className="px-4 py-2 font-semibold">Area</th>
                  <th scope="col" className="px-4 py-2 font-semibold">Status</th>
                  <th scope="col" className="px-4 py-2 font-semibold">Updated</th>
                </tr>
              </thead>
              <tbody>
                {group.listings.map((listing) => (
                  <tr
                    key={listing.id}
                    data-testid="listing-row"
                    className="relative border-b border-line last:border-0 hover:bg-surface-2"
                  >
                    <td className="px-4 py-3 font-medium">
                      <Link
                        href={`/partner/listings/${listing.id}`}
                        data-testid="listing-link"
                        className="text-link after:absolute after:inset-0 hover:underline"
                      >
                        {listing.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted">{listing.area.name}</td>
                    <td className="px-4 py-3">
                      <Badge tone={STATUS[listing.status].tone}>{STATUS[listing.status].label}</Badge>
                    </td>
                    <td className="px-4 py-3 text-muted">{UPDATED.format(new Date(listing.updated_at))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </section>
      ))}
    </div>
  );
}
