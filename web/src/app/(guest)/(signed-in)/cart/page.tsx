import type { Metadata } from "next";
import { PageBanner } from "@/components/landing/page-banner";
import { PageSheet } from "@/components/landing/page-sheet";
import { CartView } from "@/components/trips/cart-view";
import { ButtonLink } from "@/components/ui/button";
import { DisplayTitle } from "@/components/ui/typography";

export const metadata: Metadata = {
  title: "Cart",
};

// The cart: the guest's trips beside the one picked, with its items (RAA-68, RAA-135).
// `?trip=<id>` shows that trip, as "View trip" in the add-to-trip toast does.
export default async function Cart(props: PageProps<"/cart">) {
  const trip = Number((await props.searchParams).trip);
  return (
    <main data-testid="cart" className="flex flex-1 flex-col">
      <PageBanner title={<DisplayTitle size="compact">Trips you&apos;re planning</DisplayTitle>} search={false} compact>
        <ButtonLink href="/trips" variant="soft" size="sm" className="shrink-0">
          All trips
        </ButtonLink>
      </PageBanner>
      <PageSheet tone="paper">
        <div className="mx-auto flex w-full max-w-page flex-col gap-6 px-gutter pb-page-pad pt-4 max-sm:px-0 sm:pt-6">
          <CartView expandTripId={Number.isInteger(trip) && trip > 0 ? trip : undefined} />
        </div>
      </PageSheet>
    </main>
  );
}
