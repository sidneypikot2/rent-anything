import type { Metadata } from "next";
import { PageBanner } from "@/components/landing/page-banner";
import { PageSheet } from "@/components/landing/page-sheet";
import { CartView } from "@/components/trips/cart-view";
import { ButtonLink } from "@/components/ui/button";
import { DisplayTitle } from "@/components/ui/typography";

export const metadata: Metadata = {
  title: "Cart",
};

// The cart: the guest's trips with their items (RAA-68). `?trip=<id>` opens that trip, as
// "View trip" in the add-to-trip toast does.
export default async function Cart(props: PageProps<"/cart">) {
  const trip = Number((await props.searchParams).trip);
  return (
    <main data-testid="cart" className="flex flex-1 flex-col">
      <PageBanner title={<DisplayTitle>Your trips</DisplayTitle>}>
        <ButtonLink href="/trips" variant="soft" size="sm" className="self-start">
          All trips
        </ButtonLink>
      </PageBanner>
      <PageSheet>
        <div className="mx-auto flex w-full max-w-narrow flex-col gap-6 px-gutter py-page-pad">
          <CartView expandTripId={Number.isInteger(trip) && trip > 0 ? trip : undefined} />
        </div>
      </PageSheet>
    </main>
  );
}
