import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getBusiness } from "@/api/discovery";
import { BackLink } from "@/components/discovery/back-link";
import { BusinessBody, businessCount, businessId, businessView, destinationsOrNone } from "@/components/discovery/business-view";
import { PlaceGlyph } from "@/components/discovery/tag-glyphs";
import { CurrentPlace } from "@/components/landing/current-place";
import { PageBanner } from "@/components/landing/page-banner";
import { PageSheet } from "@/components/landing/page-sheet";
import { cn } from "@/components/ui/cn";
import { DisplayTitle } from "@/components/ui/typography";

export async function generateMetadata(props: PageProps<"/businesses/[id]">): Promise<Metadata> {
  const id = businessId((await props.params).id);
  const detail = id ? await getBusiness(id) : null;
  if (!detail) return { title: "Not found" };
  return { title: detail.business.name, description: detail.business.description || undefined };
}

// A business's own page (Booking.com's property page): its name and town, then BusinessBody.
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
  const { business, area, from, groups, backHref, backLabel, town } = view;
  const backPill = "tap-target self-start rounded-full border whitespace-nowrap border-glass-edge bg-glass-fill px-4 py-2 text-sm font-semibold text-white hover:bg-glass-hover";

  return (
    <main className="flex flex-1 flex-col">
      <CurrentPlace name={from.name} slug={from.slug} />
      <PageBanner
        compact
        eyebrow={groups.map((group) => group.short).join(" · ")}
        title={
          <>
            <BackLink href={backHref} className={cn(backPill, "-order-1 sm:hidden")}>
              <span aria-hidden>←</span> {backLabel}
            </BackLink>
            <DisplayTitle className="break-words text-balance">{business.name}</DisplayTitle>
            <p className="flex flex-wrap items-center gap-x-2 text-sky-mist">
              <PlaceGlyph className="size-4 text-sky-pale" />
              {[town || area.name, businessCount(view)].join(" · ")}
            </p>
          </>
        }
      >
        {/* Beside the name from sm; above it on a phone, where beside it squeezed the name. */}
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
