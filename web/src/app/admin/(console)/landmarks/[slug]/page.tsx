import type { Metadata } from "next";
import { LandmarkEditor } from "@/components/admin/landmark-form";

export const metadata: Metadata = {
  title: "Edit place to see",
};

export default async function EditLandmarkPage({ params }: PageProps<"/admin/landmarks/[slug]">) {
  const { slug } = await params;
  return <LandmarkEditor slug={slug} />;
}
