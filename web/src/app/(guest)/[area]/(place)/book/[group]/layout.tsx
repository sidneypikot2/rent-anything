import { notFound } from "next/navigation";
import { bookSection } from "@/components/area/area-listings";

// A Show all page for a group we don't have (`/<area>/book/nope`) is a real 404 (RAA-246): checked
// here, above the section's loading skeleton, for the reason `../../layout.tsx` checks the place.
// The place page's skeleton and What to book's sit in route groups beside their pages
// (`(place)/(guide)/`, `book/(all)/`): a loading.tsx in `(place)/` or `book/` would wrap this
// segment too and send its 200 first.
export default async function BookGroupLayout({ children, params }: LayoutProps<"/[area]/book/[group]">) {
  if (!bookSection((await params).group)) notFound();
  return children;
}
