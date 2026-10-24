import type { Metadata } from "next";
import { LandmarkForm } from "@/components/admin/landmark-form";

export const metadata: Metadata = {
  title: "Add place to see",
};

export default function NewLandmarkPage() {
  return <LandmarkForm />;
}
