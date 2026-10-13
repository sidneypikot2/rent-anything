import { PlaceholderBlock } from "@/components/landing/placeholder-block";
import { DisplayTitle } from "@/components/ui/typography";
import { PageSheet } from "@/components/landing/page-sheet";

const PANELS = [
  { title: "Sign-in methods", note: "Password, Google and Facebook (M1)" },
  { title: "Notifications", note: "Booking updates and messages from partners" },
];

// The guest's settings: a skeleton until account settings exist (M1).
export default function GuestSettings() {
  return (
    <main data-testid="guest-settings" className="flex flex-1 flex-col pt-3 sm:pt-6">
      <PageSheet>
        <div className="mx-auto flex w-full max-w-page flex-1 flex-col gap-block px-gutter py-page-pad">
          <DisplayTitle>Settings</DisplayTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            {PANELS.map((panel) => (
              <PlaceholderBlock key={panel.title} {...panel} />
            ))}
          </div>
        </div>
      </PageSheet>
    </main>
  );
}
