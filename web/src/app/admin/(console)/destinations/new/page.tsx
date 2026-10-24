import type { Metadata } from "next";
import { DestinationForm } from "@/components/admin/destination-form";

export const metadata: Metadata = {
  title: "Add destination",
};

export default function NewDestinationPage() {
  return <DestinationForm />;
}
