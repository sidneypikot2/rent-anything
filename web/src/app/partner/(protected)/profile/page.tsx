import { PlaceholderBlock } from "@/components/landing/placeholder-block";
import { DisplayTitle } from "@/components/ui/typography";

const PANELS = [
  { title: "Name and phone", note: "How guests and our team reach you (M1)" },
  { title: "Business details", note: "Your business name, address and what you offer (M2)" },
  { title: "ID verification", note: "Government ID and a selfie, reviewed by our team (M5)" },
];

// The partner's profile: a skeleton until profile editing exists (M1).
export default function PartnerProfile() {
  return (
    <main data-testid="partner-profile" className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-12">
      <DisplayTitle>Profile</DisplayTitle>
      <div className="grid gap-3 sm:grid-cols-2">
        {PANELS.map((panel) => (
          <PlaceholderBlock key={panel.title} {...panel} />
        ))}
      </div>
    </main>
  );
}
