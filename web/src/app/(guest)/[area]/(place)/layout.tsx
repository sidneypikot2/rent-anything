import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getAreaPlaces } from "@/api/discovery";

// A place's pages (its page and What to book) check that it exists here, above their loading
// skeletons (RAA-235): a notFound() once a skeleton has started the response keeps its 200, a
// "soft 404" a crawler may index. Thrown here, before anything streams, it is a real 404 with
// ../not-found.tsx. getAreaPlaces is cached per request, so the page's own call doesn't fetch again.
export default async function PlaceLayout({ children, params }: { children: ReactNode; params: Promise<{ area: string }> }) {
  if (!(await getAreaPlaces((await params).area))) notFound();
  return children;
}
