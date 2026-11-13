import { notFound } from "next/navigation";
import { getAreaPlaces } from "@/api/discovery";

// The plan's checklist and review for a place we don't have are a real 404 (RAA-246): checked here,
// above their loading skeletons, as `[area]/(place)/layout.tsx` does for a place's pages (a
// notFound() once a skeleton has started the response keeps its 200). ../not-found.tsx answers it.
// getAreaPlaces is cached per request, so the pages' own lookup doesn't fetch it again.
export default async function PlanPlaceLayout({ children, params }: LayoutProps<"/plan/[area]">) {
  if (!(await getAreaPlaces((await params).area))) notFound();
  return children;
}
