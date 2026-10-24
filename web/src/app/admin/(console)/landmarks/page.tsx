import type { Metadata } from "next";
import { LandmarksList } from "@/components/admin/landmarks-list";

export const metadata: Metadata = {
  title: "Places to see",
};

export default async function AdminLandmarksPage({ searchParams }: PageProps<"/admin/landmarks">) {
  const { area, status } = await searchParams;
  return (
    <LandmarksList
      key={`${area}|${status}`}
      area={typeof area === "string" ? area : undefined}
      status={status === "draft" || status === "published" ? status : undefined}
    />
  );
}
