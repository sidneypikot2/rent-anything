import Link from "next/link";
import { cn } from "@/components/ui/cn";
import type { Crumb } from "@/lib/seo";

// The visible trail over a page's title (RAA-237): Home › Bantayan Island › Island hopping tour,
// from the same list as its BreadcrumbList JSON-LD (`areaCrumbs` / `listingCrumbs`), so the two
// never disagree. It sits in the banner, on the photo or glass: the places as white links, the
// page itself last in `sky-mist`, cut to one line. It is a way up, not the way back (`BackLink`).
// Each link's line is 24px; `tap-target` gives it a 44px target on a phone (RAA-245).
export function Breadcrumbs({ crumbs, className }: { crumbs: Crumb[]; className?: string }) {
  const trail = crumbs.slice(0, -1);
  const current = crumbs.at(-1);
  return (
    <nav aria-label="Breadcrumb" data-testid="breadcrumbs" className={cn("text-sm text-sky-mist", className)}>
      <ol className="flex flex-wrap items-center gap-x-1.5">
        {trail.map((crumb) => (
          <li key={crumb.path} className="flex items-center gap-x-1.5">
            <Link href={crumb.path} className="tap-target inline-flex min-h-6 items-center font-semibold text-white underline-offset-4 hover:underline">
              {crumb.name}
            </Link>
            <span aria-hidden>›</span>
          </li>
        ))}
        {current && (
          <li aria-current="page" className="min-w-0 max-w-full truncate">
            {current.name}
          </li>
        )}
      </ol>
    </nav>
  );
}
