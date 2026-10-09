import type { Metadata } from "next";
import { CartView } from "@/components/trips/cart-view";

export const metadata: Metadata = {
  title: "Cart",
};

// The cart: the guest's trips with their items (RAA-68). `?trip=<id>` opens that trip, as
// "View trip" in the add-to-trip toast does.
export default async function Cart(props: PageProps<"/cart">) {
  const trip = Number((await props.searchParams).trip);
  return (
    <main data-testid="cart" className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10">
      <CartView expandTripId={Number.isInteger(trip) && trip > 0 ? trip : undefined} />
    </main>
  );
}
