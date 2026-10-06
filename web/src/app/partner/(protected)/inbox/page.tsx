import { PlaceholderBlock } from "@/components/landing/placeholder-block";
import { DisplayTitle } from "@/components/ui/typography";

const PANELS = [
  { title: "Conversations", note: "One thread per listing and guest, newest first (M6)" },
  { title: "Booking requests", note: "Questions that come with a request-to-book (M4)" },
];

// The partner inbox: a skeleton until chat exists (M6).
export default function PartnerInbox() {
  return (
    <main data-testid="partner-inbox" className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-12">
      <DisplayTitle>Inbox</DisplayTitle>
      <div className="grid gap-3 sm:grid-cols-2">
        {PANELS.map((panel) => (
          <PlaceholderBlock key={panel.title} {...panel} />
        ))}
      </div>
    </main>
  );
}
