import type { Metadata } from "next";
import { LandmarksList } from "@/components/admin/landmarks-list";

export const metadata: Metadata = {
  title: "Places to see",
};

export default function AdminLandmarksPage() {
  return <LandmarksList />;
}
