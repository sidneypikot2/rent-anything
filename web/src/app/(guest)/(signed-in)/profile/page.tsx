import { PlaceholderBlock } from "@/components/landing/placeholder-block";
import { DisplayTitle } from "@/components/ui/typography";

const PANELS = [
  { title: "Name and phone", note: "How partners reach you about a booking (M1)" },
  { title: "Travel preferences", note: "Who you travel with and what you like to do" },
];

// The guest's profile: a skeleton until profile editing exists (M1).
export default function GuestProfile() {
  return (
    <main data-testid="guest-profile" className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-12">
      <DisplayTitle>Profile</DisplayTitle>
      <div className="grid gap-3 sm:grid-cols-2">
        {PANELS.map((panel) => (
          <PlaceholderBlock key={panel.title} {...panel} />
        ))}
      </div>
    </main>
  );
}
