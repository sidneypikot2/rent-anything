import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getBusiness } from "@/api/discovery";
import { BackLink } from "@/components/discovery/back-link";
import { BusinessBody, businessId, businessView, destinationsOrNone } from "@/components/discovery/business-view";
import { CurrentPlace } from "@/components/landing/current-place";
import { PageBanner } from "@/components/landing/page-banner";
import { PageSheet } from "@/components/landing/page-sheet";
import { cn } from "@/components/ui/cn";
import { BRAND } from "@/lib/brand";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { areaCrumbs, canonical, metaDescription } from "@/lib/seo";

export async function generateMetadata(props: PageProps<"/businesses/[id]">): Promise<Metadata> {
  const id = businessId((await props.params).id);
  const detail = id ? await getBusiness(id) : null;
  if (!detail) return { title: "Not found" };
  const { business } = detail;
  const town = business.city ? ` in ${business.city}` : "";
  return {
    title: business.name,
    // What it says about itself, or else who it is and what the page offers (RAA-229).
    description: metaDescription(
      business.description || `${business.name}, a local partner${town}: see what it offers and request it with the rest of your trip in one cart on ${BRAND}.`,
    ),
    alternates: canonical(`/businesses/${business.id}`),
  };
}

// A business's own page (Booking.com's property page): the way back, then BusinessBody (its name under its photos, RAA-314).
// What to book's cards open it: in a new tab on a laptop, in the same tab on a phone, whose way
// back returns to the place it came from. A plan step's cards open it too (`?plan=1`, that
// step's options only): in a new tab on a laptop; on a phone the plan shows the same body over
// itself (`/plan/<area>?business=`) instead.
export default async function BusinessPage(props: PageProps<"/businesses/[id]">) {
  const id = businessId((await props.params).id);
  if (!id) notFound();
  const [detail, destinations, searchParams] = await Promise.all([getBusiness(id), destinationsOrNone(), props.searchParams]);
  if (!detail) notFound();
  const view = businessView(detail, destinations, searchParams);
  const { business, from, backHref, backLabel } = view;
  const backPill = "tap-target self-start rounded-full border whitespace-nowrap border-glass-edge bg-glass-fill px-4 py-2 text-sm font-semibold text-white hover:bg-glass-hover";

  return (
    <main className="flex flex-1 flex-col">
      <CurrentPlace name={from.name} slug={from.slug} />
      {/* The way back; its name follows its photos, in BusinessBody (RAA-314). */}
      <PageBanner
        compact
        title={
          <>
            <BackLink href={backHref} className={cn(backPill, "sm:hidden")}>
              <span aria-hidden>←</span> {backLabel}
            </BackLink>
            <Breadcrumbs crumbs={[...areaCrumbs(from), { name: business.name, path: `/businesses/${business.id}` }]} className="max-sm:hidden" />
          </>
        }
      >
        <BackLink href={backHref} className={cn(backPill, "max-sm:hidden")}>
          <span aria-hidden>←</span> {backLabel}
        </BackLink>
      </PageBanner>

      <PageSheet tone="paper">
        <BusinessBody view={view} />
      </PageSheet>
    </main>
  );
}
