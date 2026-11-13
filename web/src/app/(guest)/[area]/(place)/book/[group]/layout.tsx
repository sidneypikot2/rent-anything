import { notFound } from "next/navigation";
import { bookSection } from "@/components/area/area-listings";

// A Show all page for a group we don't have (`/<area>/book/nope`) is a real 404 (RAA-246): checked
// here, above the section's loading skeleton, for the reason `../../layout.tsx` checks the place.
export default async function BookGroupLayout({ children, params }: LayoutProps<"/[area]/book/[group]">) {
  if (!bookSection((await params).group)) notFound();
  return children;
}
