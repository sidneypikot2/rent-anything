import type { Metadata } from "next";
import { DestinationEditor } from "@/components/admin/destination-form";

export const metadata: Metadata = {
  title: "Edit destination",
};

export default async function EditDestinationPage({ params }: PageProps<"/admin/destinations/[slug]">) {
  const { slug } = await params;
  return <DestinationEditor slug={slug} />;
}
