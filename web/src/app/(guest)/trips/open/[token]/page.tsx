import type { Metadata } from "next";
import { TripLinkUnlock } from "@/components/guest/trip-link-unlock";
import { PageSheet } from "@/components/landing/page-sheet";

export const metadata: Metadata = {
  title: "Open your trips",
  robots: { index: false, follow: false },
};

// A guest's private trip link (RAA-177), from their first checkout and its email: the PIN,
// every time, then the cart.
export default async function OpenTripLink(props: PageProps<"/trips/open/[token]">) {
  const { token } = await props.params;
  return (
    <main className="flex flex-1 flex-col pt-3 sm:pt-6">
      <PageSheet>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-gutter py-page-pad">
          <TripLinkUnlock token={token} />
        </div>
      </PageSheet>
    </main>
  );
}
