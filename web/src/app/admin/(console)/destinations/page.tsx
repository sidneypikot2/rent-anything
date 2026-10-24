import type { Metadata } from "next";
import { DestinationsList } from "@/components/admin/destinations-list";

export const metadata: Metadata = {
  title: "Destinations",
};

export default function AdminDestinationsPage() {
  return <DestinationsList />;
}
