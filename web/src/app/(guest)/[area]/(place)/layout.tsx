import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getAreaPlaces } from "@/api/discovery";

// A place's pages (its page and What to book) check that it exists here, above their loading
// skeletons (RAA-235): a notFound() once a skeleton has started the response keeps its 200 and
// leaves the not-found page to the browser, with no h1 in the server's HTML. Thrown here, it is a
// 404 and ../not-found.tsx renders on the server. getAreaPlaces is cached per request, so the
// page's own call doesn't fetch it again.
export default async function PlaceLayout({ children, params }: { children: ReactNode; params: Promise<{ area: string }> }) {
  if (!(await getAreaPlaces((await params).area))) notFound();
  return children;
}
