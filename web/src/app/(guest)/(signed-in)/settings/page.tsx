import { PlaceholderBlock } from "@/components/landing/placeholder-block";
import { DisplayTitle } from "@/components/ui/typography";

const PANELS = [
  { title: "Sign-in methods", note: "Password, Google and Facebook (M1)" },
  { title: "Notifications", note: "Booking updates and messages from partners" },
];

// The guest's settings: a skeleton until account settings exist (M1).
export default function GuestSettings() {
  return (
    <main data-testid="guest-settings" className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-12">
      <DisplayTitle>Settings</DisplayTitle>
      <div className="grid gap-3 sm:grid-cols-2">
        {PANELS.map((panel) => (
          <PlaceholderBlock key={panel.title} {...panel} />
        ))}
      </div>
    </main>
  );
}
